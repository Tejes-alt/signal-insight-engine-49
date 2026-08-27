import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeSnapshot, materialize } from "./services/intelligence.server";
import { assertMember } from "./services/workspace.server";

const filterSchema = z.object({
  orgId: z.string().uuid(),
  hours: z.number().int().min(1).max(24 * 90),
  providers: z.array(z.string()).optional(),
  accountIds: z.array(z.string().uuid()).optional(),
  sentiment: z.array(z.enum(["positive", "neutral", "negative"])).optional(),
  language: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  search: z.string().nullable().optional(),
});

export const getIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filterSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { orgId, ...filters } = data;
    const snapshot = await computeSnapshot(orgId, filters);
    await materialize(orgId, snapshot);
    return snapshot;
  });
