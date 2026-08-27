import type { PlatformId, PublicContentItem, PublicMetrics, PublicProfile } from "../types";

export interface ResolvedAccount {
  profile: PublicProfile;
  metrics: PublicMetrics;
}

/**
 * A replaceable public-data source. Every platform ships its own provider, and
 * a provider only reports what it genuinely retrieved — never a guess.
 */
export interface PublicSourceProvider {
  id: PlatformId;
  /** Public metric keys this source can supply when the profile is reachable. */
  supports: (keyof PublicMetrics)[];
  normalizeHandle(input: string): string;
  profileUrl(handle: string): string;
  /** Resolves the public profile and any counters returned alongside it. */
  resolve(handle: string): Promise<ResolvedAccount>;
  /** Recent public content. Returns an empty list when the source has none. */
  content(account: ResolvedAccount): Promise<PublicContentItem[]>;
}

export const stripHandle = (input: string) =>
  input
    .trim()
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/^@+/, "")
    .replace(/\/+$/, "")
    .split("?")[0]!
    .trim();
