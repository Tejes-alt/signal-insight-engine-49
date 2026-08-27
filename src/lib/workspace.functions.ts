import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureWorkspace, listWorkspaces } from "./services/workspace.server";

/**
 * Onboarding bootstrap. Creates the workspace on first sign-in and — when the
 * installation is configured — the isolated provider profile that every social
 * connection hangs off. The user never sees or configures either step.
 */
export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    const workspace = await ensureWorkspace(context.supabase, context.userId, email);
    const all = await listWorkspaces(context.supabase, context.userId);

    let integrationsReady = false;
    try {
      const { providerConfig } = await import("./services/ayrshare.server");
      const config = providerConfig();
      integrationsReady = config.apiKeyConfigured;
      if (config.apiKeyConfigured) {
        const { ensureSocialProfile } = await import("./services/social.server");
        await ensureSocialProfile(
          workspace.id,
          context.userId,
          `SocialPulse ${workspace.slug}`,
        );
      }
    } catch (error) {
      // Never block sign-in on provider provisioning; the accounts page and the
      // admin health check both surface the real reason.
      console.error("[onboarding] provider profile provisioning deferred:", error);
    }

    return { workspace, workspaces: all, email, integrationsReady };
  });
