import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureWorkspace, listWorkspaces } from "./services/workspace.server";

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    const workspace = await ensureWorkspace(context.supabase, context.userId, email);
    const all = await listWorkspaces(context.supabase, context.userId);
    return { workspace, workspaces: all, email };
  });
