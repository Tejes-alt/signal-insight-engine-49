/**
 * The authorization handshake. Server-only.
 *
 * One implementation drives every platform: a signed, single-use state row is
 * created before the redirect and consumed on return, so the callback can be a
 * single shared route and no platform-specific logic lives in the UI.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PlatformId } from "../platforms";
import { integrationStatus } from "./config.server";
import { randomToken } from "./crypto.server";
import { providerFor } from "./registry.server";
import { saveTokens } from "./tokens.server";
import { IntegrationNotConfiguredError, type ProviderAccount, type TokenSet } from "./types";

const STATE_TTL_MINUTES = 15;

/** The single callback URL every platform redirects back to. */
export function callbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/public/social/callback`;
}

export interface BeginResult {
  url: string;
  state: string;
}

export async function beginAuthorization(input: {
  orgId: string;
  userId: string;
  platform: PlatformId;
  handle: string | null;
  origin: string;
  redirectTo: string;
}): Promise<BeginResult> {
  const status = integrationStatus(input.platform);
  if (!status.configured) {
    throw new IntegrationNotConfiguredError(input.platform, status.missing);
  }

  const provider = providerFor(input.platform);
  const state = randomToken(24);
  const codeVerifier = randomToken(48);
  const handle = input.handle?.replace(/^@/, "").trim() || null;

  const { error } = await supabaseAdmin.from("oauth_states").insert({
    state,
    org_id: input.orgId,
    user_id: input.userId,
    platform: input.platform,
    code_verifier: codeVerifier,
    redirect_to: input.redirectTo,
    handle,
    expires_at: new Date(Date.now() + STATE_TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) throw new Error(error.message);

  const { url } = await provider.connect({
    redirectUri: callbackUrl(input.origin),
    state,
    codeVerifier,
    handle,
  });
  return { url, state };
}

export interface ConsumedState {
  orgId: string;
  userId: string;
  platform: PlatformId;
  codeVerifier: string | null;
  redirectTo: string;
  handle: string | null;
}

/** Reads and burns a state row. A replayed or expired state is rejected. */
export async function consumeState(state: string): Promise<ConsumedState> {
  const { data, error } = await supabaseAdmin
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This authorization link is no longer valid. Start the connection again.");
  if (data.consumed_at) throw new Error("This authorization link was already used.");
  if (Date.parse(data.expires_at as string) < Date.now()) {
    throw new Error("This authorization link expired. Start the connection again.");
  }
  await supabaseAdmin
    .from("oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("state", state);

  return {
    orgId: data.org_id as string,
    userId: data.user_id as string,
    platform: data.platform as PlatformId,
    codeVerifier: (data.code_verifier as string | null) ?? null,
    redirectTo: data.redirect_to as string,
    handle: (data.handle as string | null) ?? null,
  };
}

export interface CompletedAuthorization {
  connectionId: string;
  platform: PlatformId;
  account: ProviderAccount;
  redirectTo: string;
  orgId: string;
}

/**
 * Exchanges the authorization code, stores the encrypted credentials and
 * records the confirmed account on the workspace connection.
 */
export async function completeAuthorization(input: {
  state: ConsumedState;
  code: string;
  origin: string;
}): Promise<CompletedAuthorization> {
  const provider = providerFor(input.state.platform);
  const token: TokenSet = await provider.callback({
    code: input.code,
    redirectUri: callbackUrl(input.origin),
    codeVerifier: input.state.codeVerifier,
  });
  const account = await provider.getAccount(token);

  const { upsertConnectedAccount } = await import("@/lib/services/social.server");
  const connection = await upsertConnectedAccount({
    orgId: input.state.orgId,
    userId: input.state.userId,
    platform: input.state.platform,
    account,
    scopes: token.scopes,
    capabilities: provider.capabilities,
  });

  await saveTokens({
    orgId: input.state.orgId,
    connectionId: connection.id,
    platform: input.state.platform,
    token,
  });

  return {
    connectionId: connection.id,
    platform: input.state.platform,
    account,
    redirectTo: input.state.redirectTo,
    orgId: input.state.orgId,
  };
}
