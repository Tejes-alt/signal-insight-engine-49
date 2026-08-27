/**
 * Public-source registry.
 *
 * Providers are replaceable: swap or add an implementation here and the rest of
 * SocialPulse keeps working. No provider requires a credential from the person
 * using the app.
 */

import type { PlatformId, PublicContentItem, PublicMetrics, PublicProfile } from "./types";
import type { PublicSourceProvider, ResolvedAccount } from "./providers/types";
import { youtubeProvider } from "./providers/youtube.server";
import { tiktokProvider } from "./providers/tiktok.server";
import { instagramProvider } from "./providers/instagram.server";
import { twitterProvider } from "./providers/twitter.server";
import { linkedinProvider } from "./providers/linkedin.server";
import { facebookProvider } from "./providers/facebook.server";

const providers: Record<PlatformId, PublicSourceProvider> = {
  youtube: youtubeProvider,
  tiktok: tiktokProvider,
  instagram: instagramProvider,
  twitter: twitterProvider,
  linkedin: linkedinProvider,
  facebook: facebookProvider,
};

export function getProvider(platform: PlatformId): PublicSourceProvider {
  return providers[platform];
}

export function normalizeHandle(platform: PlatformId, input: string): string {
  return getProvider(platform).normalizeHandle(input);
}

/** Resolves a handle or profile URL into a public profile plus its counters. */
export async function resolveProfile(
  platform: PlatformId,
  handleOrUrl: string,
): Promise<ResolvedAccount> {
  const provider = getProvider(platform);
  return provider.resolve(provider.normalizeHandle(handleOrUrl));
}

export async function getPublicProfile(
  platform: PlatformId,
  handleOrUrl: string,
): Promise<PublicProfile> {
  return (await resolveProfile(platform, handleOrUrl)).profile;
}

export async function getPublicMetrics(
  platform: PlatformId,
  handleOrUrl: string,
): Promise<PublicMetrics> {
  return (await resolveProfile(platform, handleOrUrl)).metrics;
}

export async function getPublicContent(
  platform: PlatformId,
  account: ResolvedAccount,
): Promise<PublicContentItem[]> {
  try {
    return await getProvider(platform).content(account);
  } catch {
    return [];
  }
}

/** Aggregate counters derived from the retrieved public content. */
export function getPublicContentMetrics(items: PublicContentItem[]): {
  avgViews: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  totalViews: number | null;
  totalLikes: number | null;
  totalComments: number | null;
} {
  const avg = (key: "views" | "likes" | "comments") => {
    const values = items.map((i) => i[key]).filter((v): v is number => typeof v === "number");
    if (!values.length) return { avg: null, total: null };
    const total = values.reduce((a, b) => a + b, 0);
    return { avg: Math.round(total / values.length), total };
  };
  const views = avg("views");
  const likes = avg("likes");
  const comments = avg("comments");
  return {
    avgViews: views.avg,
    avgLikes: likes.avg,
    avgComments: comments.avg,
    totalViews: views.total,
    totalLikes: likes.total,
    totalComments: comments.total,
  };
}
