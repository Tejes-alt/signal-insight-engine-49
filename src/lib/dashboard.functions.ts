import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertMember } from "./services/workspace.server";
import { buildLiveBundle } from "./services/dashboard.server";
import { buildDemoBundle } from "./demo/generate";
import type { AnalyticsBundle } from "./analytics/dashboard";

const schema = z.object({
  orgId: z.string().uuid(),
  rangeDays: z.number().int().min(7).max(365),
  demo: z.boolean(),
});

/**
 * Returns the dashboard bundle. Demo mode short-circuits before any database
 * read so sample data can never mix into a real workspace's stored analytics.
 */
export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }): Promise<AnalyticsBundle> => {
    if (data.demo) return buildDemoBundle(data.rangeDays);
    await assertMember(context.supabase, data.orgId, context.userId);
    return buildLiveBundle(data.orgId, data.rangeDays);
  });
