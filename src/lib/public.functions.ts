import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertMember } from "./services/workspace.server";
import { PLATFORM_IDS, type PlatformId } from "./social/platforms";
import type { OverviewBundle } from "./public/types";

const platformEnum = z.enum(PLATFORM_IDS as [PlatformId, ...PlatformId[]]);
const orgInput = z.object({ orgId: z.string().uuid() });

/** Tracked public accounts plus analytics derived from stored snapshots. */
export const getPublicOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgInput.extend({ rangeDays: z.number().int().min(7).max(365) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<OverviewBundle> => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { listAccounts } = await import("./public/aggregator.server");
    const { buildOverview } = await import("./public/analytics");
    const accounts = await listAccounts(context.supabase, data.orgId);
    return buildOverview(accounts, data.rangeDays);
  });

/** Starts tracking a handle and immediately retrieves its public information. */
export const addPublicAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgInput.extend({ platform: platformEnum, handle: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { addAccount } = await import("./public/aggregator.server");
    return addAccount(context.supabase, data.orgId, data.platform, data.handle);
  });

export const removePublicAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgInput.extend({ accountId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { removeAccount } = await import("./public/aggregator.server");
    await removeAccount(context.supabase, data.orgId, data.accountId);
    return { ok: true as const };
  });

/** Re-checks one tracked account and stores a new snapshot. */
export const refreshPublicAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgInput.extend({ accountId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { refreshAccount } = await import("./public/aggregator.server");
    const { data: row } = await context.supabase
      .from("public_accounts")
      .select("*")
      .eq("id", data.accountId)
      .eq("org_id", data.orgId)
      .single();
    if (!row) throw new Error("That account is no longer tracked.");
    return refreshAccount(context.supabase, row as never);
  });

/** Re-checks every tracked account. */
export const refreshAllPublicAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { refreshAll } = await import("./public/aggregator.server");
    const outcomes = await refreshAll(context.supabase, data.orgId);
    return { outcomes, checkedAt: new Date().toISOString() };
  });
