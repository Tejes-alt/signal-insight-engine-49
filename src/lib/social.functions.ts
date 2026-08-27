import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertMember } from "./services/workspace.server";
import { PLATFORM_IDS, type PlatformId } from "./social/platforms";

const orgInput = z.object({ orgId: z.string().uuid() });
const platformEnum = z.enum(PLATFORM_IDS as [PlatformId, ...PlatformId[]]);

/** Connections + provider configuration for the Accounts page. */
export const getSocialState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { listConnections, refreshConnectionStatuses } = await import("./services/social.server");
    const { providerConfig } = await import("./services/ayrshare.server");
    const config = providerConfig();
    let connections = await listConnections(data.orgId);
    if (config.apiKeyConfigured) {
      try {
        connections = await refreshConnectionStatuses(data.orgId);
      } catch {
        // Keep the stored view when the provider is temporarily unreachable.
      }
    }
    return { connections, config };
  });

/** Creates the isolated provider profile (if needed) and returns an auth URL. */
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
    const { ensureSocialProfile, upsertPendingConnection } = await import("./services/social.server");
    const { socialProvider, providerConfig, NOT_CONFIGURED_MESSAGE, LINKING_NOT_CONFIGURED_MESSAGE } =
      await import("./services/ayrshare.server");

    // Fail loudly and specifically before touching the database.
    const config = providerConfig();
    if (!config.apiKeyConfigured) {
      console.error("[connect] aborted: AYRSHARE_API_KEY is not set on the server.");
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    if (!config.linkingConfigured) {
      console.error(`[connect] aborted: missing ${config.missing.join(", ")}.`);
      throw new Error(LINKING_NOT_CONFIGURED_MESSAGE);
    }
    console.info(`[connect] starting ${data.platform} authorization for org ${data.orgId}`);

    const profile = await ensureSocialProfile(data.orgId, context.userId, `SocialPulse ${data.orgId.slice(0, 8)}`);
    await upsertPendingConnection({
      orgId: data.orgId,
      userId: context.userId,
      profileId: profile.id,
      platform: data.platform,
      handle: data.handle?.replace(/^@/, "") ?? null,
    });
    const { url } = await socialProvider.connectAccount({
      profileKey: profile.profileKey,
      redirect: data.returnUrl,
      platforms: [data.platform],
    });
    console.info(`[connect] authorization URL issued for ${data.platform}`);
    return { url };
  });

/** Runs after the platform redirects back — reconciles and syncs. */
export const completeConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { refreshConnectionStatuses, syncAll, notify } = await import("./services/social.server");
    const connections = await refreshConnectionStatuses(data.orgId);
    if (connections.length > 0) {
      await notify(data.orgId, "account_connected", "Account connected", null, "success", {});
    }
    const outcomes = await syncAll(data.orgId);
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
    await assertMember(context.supabase, data.orgId, context.userId);
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
