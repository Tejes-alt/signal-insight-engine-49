import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureWorkspace, listWorkspaces } from "./services/workspace.server";

/**
 * Onboarding bootstrap. Creates the personal workspace on first sign-in.
 * There is nothing for anyone to configure: SocialPulse needs no keys.
 */
export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    const workspace = await ensureWorkspace(context.supabase, context.userId, email);
    const all = await listWorkspaces(context.supabase, context.userId);
    const role = all.find((w) => w.id === workspace.id)?.role ?? "member";

    return { workspace, workspaces: all, email, role };
  });

