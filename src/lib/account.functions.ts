import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * SocialPulse account management. The SocialPulse email/password is only ever
 * used for SocialPulse itself — never for any social platform.
 */

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, display_name, created_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { profile: data ?? null };
  });

export const saveProfileName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ displayName: z.string().trim().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    const { error } = await context.supabase.from("profiles").upsert(
      {
        id: context.userId,
        email,
        display_name: data.displayName,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Permanently removes the signed-in user's SocialPulse account and all data. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orgs } = await context.supabase
      .from("memberships")
      .select("org_id, role")
      .eq("user_id", context.userId);

    for (const row of orgs ?? []) {
      if (row.role !== "owner") continue;
      await supabaseAdmin.from("public_accounts").delete().eq("org_id", row.org_id);
      await supabaseAdmin.from("memberships").delete().eq("org_id", row.org_id);
      await supabaseAdmin.from("organizations").delete().eq("id", row.org_id);
    }
    await supabaseAdmin.from("memberships").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", context.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
