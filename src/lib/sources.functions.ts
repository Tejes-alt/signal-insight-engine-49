import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  addPublicSource,
  listSources,
  providerRuntimeStatus,
  removeSource,
  updateSource,
} from "./services/sources.server";
import { syncAccount } from "./services/ingestion.server";
import { assertMember } from "./services/workspace.server";
import type { ProviderId } from "./providers/registry";

const orgSchema = z.object({ orgId: z.string().uuid() });

export const getSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    return {
      sources: await listSources(context.supabase, data.orgId),
      runtime: providerRuntimeStatus(),
    };
  });

export const createPublicSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgSchema
      .extend({
        provider: z.enum(["youtube", "x", "tiktok", "instagram"]),
        input: z.string().min(2).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    addPublicSource(
      context.supabase,
      data.orgId,
      context.userId,
      data.provider as ProviderId,
      data.input.trim(),
    ),
  );

export const syncSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgSchema.extend({ sourceId: z.string().uuid(), full: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    return syncAccount(data.orgId, data.sourceId, { full: data.full ?? false });
  });

export const patchSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgSchema
      .extend({
        sourceId: z.string().uuid(),
        label: z.string().max(80).nullable().optional(),
        paused: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await updateSource(context.supabase, data.orgId, context.userId, data.sourceId, {
      ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.paused !== undefined ? { paused: data.paused } : {}),
    });
    return { ok: true };
  });

export const deleteSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgSchema.extend({ sourceId: z.string().uuid(), deleteData: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await removeSource(context.supabase, data.orgId, context.userId, data.sourceId, data.deleteData);
    return { ok: true };
  });
