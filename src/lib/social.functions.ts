import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertMember } from "./services/workspace.server";

/**
 * Workspace-level preferences, notifications, privacy controls and internal
 * diagnostics. Nothing here is platform-specific: public profile tracking
 * lives in `public.functions.ts`.
 */

const orgInput = z.object({ orgId: z.string().uuid() });

export const getNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { data: rows, error } = await context.supabase
      .from("notifications")
      .select("id, title, body, created_at, read_at")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { notifications: rows ?? [] };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() } as never)
      .eq("org_id", data.orgId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Privacy control: removes every tracked handle and stored snapshot. */
export const purgeWorkspaceData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { error } = await context.supabase
      .from("public_accounts")
      .delete()
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Operator diagnostics. Owners and admins only; never surfaced to members. */
export const getSetupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    const role = await assertMember(context.supabase, data.orgId, context.userId);
    if (!["owner", "admin"].includes(role)) throw new Error("Not available for this account.");

    const { allIntegrationStatuses } = await import("./social/oauth/config.server");
    const { PLATFORMS } = await import("./social/platforms");
    const integrations = allIntegrationStatuses().map((status) => ({
      platform: status.platform,
      name: PLATFORMS[status.platform].name,
      configured: status.configured,
      missing: status.missing,
    }));

    const { data: accounts, error } = await context.supabase
      .from("public_accounts")
      .select("id, last_checked_at")
      .eq("org_id", data.orgId);

    const now = Date.now();
    const staleAfter = 12 * 60 * 60 * 1000;
    const due = (accounts ?? []).filter(
      (a) => !a.last_checked_at || now - Date.parse(a.last_checked_at) > staleAfter,
    ).length;
    const next = (accounts ?? [])
      .map((a) => (a.last_checked_at ? Date.parse(a.last_checked_at) + staleAfter : now))
      .sort((a, b) => a - b)[0];

    return {
      integrations,
      configuredCount: integrations.filter((i) => i.configured).length,
      database: !error,
      connections: accounts?.length ?? 0,
      backgroundSync: {
        enabled: (accounts?.length ?? 0) > 0,
        due,
        nextSyncAt: next ? new Date(next).toISOString() : null,
      },
    };
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
    return { ok: true as const };
  });
