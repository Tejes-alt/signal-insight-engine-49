import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertMember } from "./services/workspace.server";
import { PLATFORM_IDS, type PlatformId } from "./social/platforms";

const orgInput = z.object({ orgId: z.string().uuid() });
const platformEnum = z.enum(PLATFORM_IDS as [PlatformId, ...PlatformId[]]);

/** Connections + per-platform integration readiness for the Accounts page. */
export const getSocialState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { listConnections, refreshConnectionStatuses } = await import("./services/social.server");
    const { allIntegrationStatuses } = await import("./social/oauth/config.server");
    let connections = await listConnections(data.orgId);
    try {
      connections = await refreshConnectionStatuses(data.orgId);
    } catch {
      // Keep the stored view when reconciliation temporarily fails.
    }
    const integrations = allIntegrationStatuses();
    return {
      connections,
      integrations,
      config: {
        anyConfigured: integrations.some((i) => i.configured),
        configuredCount: integrations.filter((i) => i.configured).length,
      },
    };
  });

/** Starts the official authorization flow and returns the platform's URL. */
export const startConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgInput
      .extend({
        platform: platformEnum,
        handle: z.string().trim().max(120).nullable(),
        returnUrl: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { beginAuthorization } = await import("./social/oauth/flow.server");
    const origin = new URL(data.returnUrl).origin;
    const { url } = await beginAuthorization({
      orgId: data.orgId,
      userId: context.userId,
      platform: data.platform,
      handle: data.handle,
      origin,
      redirectTo: data.returnUrl,
    });
    return { url };
  });

/** Looks for a public profile that may belong to the user. Never authoritative. */
export const discoverAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgInput.extend({ platform: platformEnum, handle: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { discoverForWorkspace } = await import("./services/social.server");
    return discoverForWorkspace(data.orgId, context.userId, data.platform, data.handle);
  });

/** Runs after the platform redirects back — reconciles and syncs. */
export const completeConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { refreshConnectionStatuses, syncStale } = await import("./services/social.server");
    const outcomes = await syncStale(data.orgId);
    return { connections: await refreshConnectionStatuses(data.orgId), outcomes };
  });


export const syncAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.extend({ connectionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { syncConnection, generateInsights } = await import("./services/social.server");
    const outcome = await syncConnection(data.orgId, data.connectionId);
    await generateInsights(data.orgId, 30);
    return outcome;
  });

export const syncAllAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { syncAll } = await import("./services/social.server");
    return { outcomes: await syncAll(data.orgId) };
  });

/**
 * Automatic refresh: syncs only the accounts whose scheduled refresh time has
 * elapsed. Safe to call on dashboard load — cached data is left untouched.
 */
export const syncStaleAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { listConnections, syncConnection, generateInsights } = await import(
      "./services/social.server"
    );
    const now = Date.now();
    const due = (await listConnections(data.orgId)).filter(
      (c) => c.status !== "pending" && (!c.nextSyncAt || Date.parse(c.nextSyncAt) <= now),
    );
    const outcomes = [];
    for (const connection of due) outcomes.push(await syncConnection(data.orgId, connection.id));
    if (outcomes.length > 0) await generateInsights(data.orgId, 30);
    return { synced: outcomes.length, outcomes };
  });


export const disconnectAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgInput.extend({ connectionId: z.string().uuid(), deleteData: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { disconnectConnection } = await import("./services/social.server");
    await disconnectConnection(data.orgId, data.connectionId, data.deleteData);
    return { ok: true };
  });

export const purgeWorkspaceData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgInput.extend({ scope: z.enum(["analytics", "everything"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { deleteWorkspaceAnalytics, deleteEverything } = await import("./services/social.server");
    if (data.scope === "everything") await deleteEverything(data.orgId);
    else await deleteWorkspaceAnalytics(data.orgId);
    return { ok: true };
  });

export const getNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { data: rows, error } = await context.supabase
      .from("notifications")
      .select("id, kind, title, body, severity, read_at, created_at")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { notifications: rows ?? [] };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("org_id", data.orgId)
      .is("read_at", null);
    return { ok: true };
  });

export const getInsightRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { listInsights } = await import("./services/social.server");
    return { insights: await listInsights(data.orgId) };
  });

export const getSetupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    const role = await assertMember(context.supabase, data.orgId, context.userId);
    if (!["owner", "admin"].includes(role)) {
      throw new Error("You don't have access to this page.");
    }
    const { setupStatus } = await import("./services/social.server");
    return setupStatus(data.orgId);
  });

const preferencesSchema = z.object({
  primaryPlatform: z.string().nullable().optional(),
  preferredMetrics: z.array(z.string()).optional(),
  defaultRangeDays: z.number().int().min(7).max(365).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  notificationSettings: z.record(z.string(), z.boolean()).optional(),
  onboardingCompleted: z.boolean().optional(),
  goal: z.string().max(60).nullable().optional(),
});

export const getPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { preferences: data ?? null };
  });

export const savePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => preferencesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const payload: Record<string, unknown> = { user_id: context.userId };
    if (data.primaryPlatform !== undefined) payload["primary_platform"] = data.primaryPlatform;
    if (data.preferredMetrics !== undefined) payload["preferred_metrics"] = data.preferredMetrics;
    if (data.defaultRangeDays !== undefined) payload["default_range_days"] = data.defaultRangeDays;
    if (data.theme !== undefined) payload["theme"] = data.theme;
    if (data.notificationSettings !== undefined) payload["notification_settings"] = data.notificationSettings;
    if (data.onboardingCompleted !== undefined) payload["onboarding_completed"] = data.onboardingCompleted;
    if (data.goal !== undefined) payload["goal"] = data.goal;
    const { error } = await context.supabase
      .from("user_preferences")
      .upsert(payload as never, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
