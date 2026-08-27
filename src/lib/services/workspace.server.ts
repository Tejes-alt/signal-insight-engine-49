/**
 * Workspace (organization) resolution. Server-only.
 *
 * Every signed-in user belongs to at least one workspace; the first one is
 * created on demand with the user as owner. All intelligence data is scoped to
 * a workspace id, which is authorized on every read and write.
 */

import type { JsonObject } from "../json";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  retentionDays: number;
  isDemo: boolean;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "workspace"
  );
}

export async function listWorkspaces(
  supabase: SupabaseClient,
  userId: string,
): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organizations(id, name, slug, retention_days, is_demo)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => row.organizations)
    .map((row) => {
      const org = row.organizations as unknown as {
        id: string;
        name: string;
        slug: string;
        retention_days: number;
        is_demo: boolean;
      };
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: row.role as string,
        retentionDays: org.retention_days,
        isDemo: org.is_demo,
      };
    });
}

export async function ensureWorkspace(
  supabase: SupabaseClient,
  userId: string,
  email: string | null,
): Promise<Workspace> {
  const existing = await listWorkspaces(supabase, userId);
  if (existing.length > 0) return existing[0]!;

  const base = slugify(email?.split("@")[0] ?? "analyst");
  const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  const name = `${email?.split("@")[0] ?? "Personal"} workspace`;

  const { data: org, error } = await supabase
    .from("organizations")
    .insert({ name, slug, owner_id: userId })
    .select("id, name, slug, retention_days, is_demo")
    .single();
  if (error) throw new Error(error.message);

  const { error: memberError } = await supabase
    .from("memberships")
    .insert({ org_id: org.id, user_id: userId, role: "owner" });
  if (memberError) throw new Error(memberError.message);

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    role: "owner",
    retentionDays: org.retention_days,
    isDemo: org.is_demo,
  };
}

/** Throws unless the caller is a member of the workspace. */
export async function assertMember(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You do not have access to this workspace.");
  return data.role as string;
}

export async function audit(
  orgId: string,
  actorId: string,
  action: string,
  target: string | null,
  details: JsonObject = {},
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("audit_logs")
    .insert({ org_id: orgId, actor_id: actorId, action, target, details });
}
