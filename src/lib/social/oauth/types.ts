/**
 * The universal social integration contract.
 *
 * Every platform is implemented once against this interface. Nothing outside a
 * provider module knows about endpoints, scopes, or credential formats.
 */

import type { JsonObject } from "@/lib/json";
import type { MetricKey, MetricStatus } from "../model";
import type { PlatformId } from "../platforms";

export interface StoredMetric {
  value: number | null;
  status: MetricStatus;
  reason?: string;
}

export type StoredMetrics = Partial<Record<MetricKey, StoredMetric>>;

export const value = (n: number): StoredMetric => ({ value: n, status: "available" });
export const absent = (status: Exclude<MetricStatus, "available">, reason: string): StoredMetric => ({
  value: null,
  status,
  reason,
});

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  /** ISO timestamp, or null when the platform issues non-expiring credentials. */
  expiresAt?: string | null;
  scopes: string[];
  metadata?: JsonObject;
}

export interface ProviderAccount {
  externalId: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  metadata: JsonObject;
}

export interface HistoryPoint {
  date: string; // YYYY-MM-DD
  metrics: StoredMetrics;
}

export interface ProviderAnalytics {
  metrics: StoredMetrics;
  history: HistoryPoint[];
}

export interface ProviderContentItem {
  externalId: string;
  title: string | null;
  caption: string | null;
  mediaType: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  publishedAt: string;
  metrics: StoredMetrics;
}

export interface DiscoveredAccount {
  platform: PlatformId;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  /** "possible" until the platform itself confirms ownership through authorization. */
  confidence: "possible" | "confirmed";
  source: string;
}

export interface AuthorizeRequest {
  redirectUri: string;
  state: string;
  codeVerifier: string;
  handle: string | null;
}

export interface CallbackRequest {
  code: string;
  redirectUri: string;
  codeVerifier: string | null;
}

export class IntegrationNotConfiguredError extends Error {
  platform: PlatformId;
  missing: string[];
  constructor(platform: PlatformId, missing: string[]) {
    super(`The ${platform} integration is not configured on this installation.`);
    this.name = "IntegrationNotConfiguredError";
    this.platform = platform;
    this.missing = missing;
  }
}

export class ProviderRequestError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = "provider_error") {
    super(message);
    this.name = "ProviderRequestError";
    this.status = status;
    this.code = code;
  }
}

export interface SocialProvider {
  id: PlatformId;
  /** Server-side configuration keys this platform needs. Never shown to users. */
  requiredSecrets: string[];
  /** Metrics this platform can legitimately return once authorized. */
  capabilities: MetricKey[];
  /** Look for a public profile that may belong to the user. Never authoritative. */
  discoverAccount(hint: { handle?: string | null; email?: string | null }): Promise<DiscoveredAccount | null>;
  /** Build the official authorization URL. */
  connect(req: AuthorizeRequest): Promise<{ url: string }>;
  /** Exchange the authorization response for stored credentials. */
  callback(req: CallbackRequest): Promise<TokenSet>;
  getAccount(token: TokenSet): Promise<ProviderAccount>;
  getAnalytics(token: TokenSet, account: ProviderAccount): Promise<ProviderAnalytics>;
  getContent(token: TokenSet, account: ProviderAccount): Promise<ProviderContentItem[]>;
  getContentAnalytics(
    token: TokenSet,
    account: ProviderAccount,
    items: ProviderContentItem[],
  ): Promise<ProviderContentItem[]>;
  /** Renew credentials when the platform supports it; null when not applicable. */
  refresh(token: TokenSet): Promise<TokenSet | null>;
  /** Revoke the authorization with the platform where an endpoint exists. */
  disconnect(token: TokenSet): Promise<void>;
}
