/**
 * Encrypted credential store. Server-only.
 *
 * Platform credentials never leave the server: they are written encrypted with
 * aes-256-gcm and are only decrypted inside a synchronization handler.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { JsonObject } from "@/lib/json";
import { decryptSecret, encryptSecret } from "./crypto.server";
import type { SocialProvider, TokenSet } from "./types";

export async function saveTokens(input: {
  orgId: string;
  connectionId: string;
  platform: string;
  token: TokenSet;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("social_tokens").upsert(
    {
      org_id: input.orgId,
      connection_id: input.connectionId,
      platform: input.platform,
      access_token_ciphertext: encryptSecret(input.token.accessToken),
      refresh_token_ciphertext: input.token.refreshToken
        ? encryptSecret(input.token.refreshToken)
        : null,
      expires_at: input.token.expiresAt ?? null,
      scopes: input.token.scopes,
      metadata: (input.token.metadata ?? {}) as JsonObject,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_id" },
  );
  if (error) throw new Error(error.message);
}

export async function loadTokens(connectionId: string): Promise<TokenSet | null> {
  const { data, error } = await supabaseAdmin
    .from("social_tokens")
    .select("access_token_ciphertext, refresh_token_ciphertext, expires_at, scopes, metadata")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    accessToken: decryptSecret(data.access_token_ciphertext as string),
    refreshToken: data.refresh_token_ciphertext
      ? decryptSecret(data.refresh_token_ciphertext as string)
      : null,
    expiresAt: (data.expires_at as string | null) ?? null,
    scopes: Array.isArray(data.scopes) ? (data.scopes as string[]) : [],
    metadata: (data.metadata ?? {}) as JsonObject,
  };
}

export async function deleteTokens(connectionId: string): Promise<void> {
  await supabaseAdmin.from("social_tokens").delete().eq("connection_id", connectionId);
}

/**
 * Returns a token guaranteed usable right now, renewing it first when the
 * platform issued an expiring credential and supports refresh.
 */
export async function usableToken(
  provider: SocialProvider,
  orgId: string,
  connectionId: string,
): Promise<TokenSet> {
  const stored = await loadTokens(connectionId);
  if (!stored) {
    throw new Error("This account is no longer authorized. Reconnect it to resume analytics.");
  }
  const expiresAt = stored.expiresAt ? Date.parse(stored.expiresAt) : null;
  const expiringSoon = expiresAt !== null && expiresAt - Date.now() < 5 * 60_000;
  if (!expiringSoon) return stored;

  const renewed = await provider.refresh(stored);
  if (!renewed) return stored;
  await saveTokens({ orgId, connectionId, platform: provider.id, token: renewed });
  return renewed;
}
