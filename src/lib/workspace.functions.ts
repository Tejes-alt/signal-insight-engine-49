import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureWorkspace, listWorkspaces } from "./services/workspace.server";

/**
 * Onboarding bootstrap. Creates the workspace on first sign-in and reports
 * which official platform integrations this installation can offer. The user
 * never sees or configures either step.
 */
export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    const workspace = await ensureWorkspace(context.supabase, context.userId, email);
    const all = await listWorkspaces(context.supabase, context.userId);

    let integrationsReady = false;
    let readyPlatforms: string[] = [];
    try {
      const { allIntegrationStatuses } = await import("./social/oauth/config.server");
      const statuses = allIntegrationStatuses();
      readyPlatforms = statuses.filter((s) => s.configured).map((s) => s.platform);
      integrationsReady = readyPlatforms.length > 0;
    } catch (error) {
      // Never block sign-in on integration inspection; the accounts page and
      // the admin health check both surface the real reason.
      console.error("[onboarding] integration status unavailable:", error);
    }

    return { workspace, workspaces: all, email, integrationsReady, readyPlatforms };
  });

