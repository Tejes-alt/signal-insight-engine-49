/**
 * Source management service. Server-only.
 * Owns provider configuration status, source creation, and lifecycle actions.
 */

import type { JsonObject } from "../json";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PROVIDER_LIST, type ProviderId } from "../providers/registry";
import { resolvePublicSource } from "./ingestion.server";
import { assertMember, audit } from "./workspace.server";

export interface ProviderRuntimeStatus {
  id: ProviderId;
  publicModeReady: boolean;
  oauthReady: boolean;
  missingEnv: string[];
}

/** Which providers can actually run right now, based on server secrets. */
export function providerRuntimeStatus(): ProviderRuntimeStatus[] {
  return PROVIDER_LIST.map((p) => {
    const missingPublic = p.modes.public.requiredEnv.filter((k) => !process.env[k]);
    const missingOauth = p.modes.oauth.requiredEnv.filter((k) => !process.env[k]);
    return {
      id: p.id,
      publicModeReady: p.modes.public.implemented && missingPublic.length === 0,
      oauthReady: p.modes.oauth.implemented && missingOauth.length === 0,
      missingEnv: Array.from(new Set([...missingPublic, ...missingOauth])),
    };
  });
}

export interface SourceRow {
  id: string;
  provider: string;
  mode: string;
  externalId: string;
  handle: string | null;
  displayName: string | null;
  label: string | null;
  avatarUrl: string | null;
  status: string;
  syncStatus: string;
  paused: boolean;
  followers: number | null;
  recordsCollected: number;
  errorCount: number;
  lastError: string | null;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  createdAt: string;
  metadata: JsonObject;
}

export async function listSources(supabase: SupabaseClient, orgId: string): Promise<SourceRow[]> {
  const { data, error } = await supabase
    .from("provider_accounts")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    provider: r.provider,
    mode: r.mode,
    externalId: r.external_id,
    handle: r.handle,
    displayName: r.display_name,
    label: r.label,
    avatarUrl: r.avatar_url,
    status: r.status,
    syncStatus: r.sync_status,
    paused: r.paused,
    followers: r.followers === null ? null : Number(r.followers),
    recordsCollected: r.records_collected,
    errorCount: r.error_count,
    lastError: r.last_error,
    lastSyncedAt: r.last_synced_at,
    nextSyncAt: r.next_sync_at,
    createdAt: r.created_at,
    metadata: r.metadata ?? {},
  }));
}

export async function addPublicSource(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  provider: ProviderId,
  input: string,
): Promise<SourceRow> {
  await assertMember(supabase, orgId, userId);
  const resolved = await resolvePublicSource(provider, input);

  const { data, error } = await supabaseAdmin
    .from("provider_accounts")
    .upsert(
      {
        org_id: orgId,
        provider,
        mode: "public",
        external_id: resolved.externalId,
        handle: resolved.handle,
        display_name: resolved.displayName,
        avatar_url: resolved.avatarUrl,
        followers: resolved.followers,
        metadata: resolved.metadata,
        status: "connected",
        connected_by: userId,
        next_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider,external_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await audit(orgId, userId, "source.added", data.id, { provider, externalId: resolved.externalId });

  const rows = await listSources(supabase, orgId);
  return rows.find((r) => r.id === data.id)!;
}

export async function updateSource(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  sourceId: string,
  patch: { label?: string | null | undefined; paused?: boolean | undefined },
): Promise<void> {
  await assertMember(supabase, orgId, userId);
  const { error } = await supabaseAdmin
    .from("provider_accounts")
    .update({
      updated_at: new Date().toISOString(),
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.paused !== undefined
        ? {
            paused: patch.paused,
            next_sync_at: patch.paused ? null : new Date().toISOString(),
          }
        : {}),
    })
    .eq("id", sourceId)
    .eq("org_id", orgId);
  if (error) throw new Error(error.message);
  await audit(orgId, userId, "source.updated", sourceId, patch as JsonObject);
}

export async function removeSource(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  sourceId: string,
  deleteData: boolean,
): Promise<void> {
  const role = await assertMember(supabase, orgId, userId);
  if (!["owner", "admin"].includes(role)) {
    throw new Error("Only workspace owners and admins can remove a source.");
  }
  if (deleteData) {
    await supabaseAdmin.from("posts").delete().eq("org_id", orgId).eq("provider_account_id", sourceId);
  } else {
    await supabaseAdmin
      .from("posts")
      .update({ provider_account_id: null })
      .eq("org_id", orgId)
      .eq("provider_account_id", sourceId);
  }
  const { error } = await supabaseAdmin
    .from("provider_accounts")
    .delete()
    .eq("id", sourceId)
    .eq("org_id", orgId);
  if (error) throw new Error(error.message);
  await audit(orgId, userId, "source.removed", sourceId, { deleteData });
}
