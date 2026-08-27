/**
 * Platform catalogue for SocialPulse.
 *
 * Client-safe: descriptive metadata only, no secrets and no network code.
 * `metrics` lists the metrics the platform legitimately exposes through the
 * social provider. Anything not listed renders as "Not available for this
 * platform" rather than a zero.
 */

import type { MetricKey } from "./model";

export type PlatformId =
  | "youtube"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "twitter"
  | "facebook";

export interface PlatformDescriptor {
  id: PlatformId;
  name: string;
  mark: string;
  /** CSS colour used for accents and chart series. */
  accent: string;
  handlePrefix: string;
  handleLabel: string;
  handlePlaceholder: string;
  description: string;
  /** Metrics the provider can return for an authorized account. */
  metrics: MetricKey[];
  notes: string;
}

const base: Record<PlatformId, PlatformDescriptor> = {
  youtube: {
    id: "youtube",
    name: "YouTube",
    mark: "YT",
    accent: "#ff2d55",
    handlePrefix: "@",
    handleLabel: "Channel handle",
    handlePlaceholder: "mychannel",
    description: "Channel growth, video performance and watch time.",
    metrics: [
      "subscriberCount",
      "followers",
      "views",
      "videoViews",
      "likes",
      "comments",
      "shares",
      "watchTime",
      "posts",
      "engagement",
      "engagementRate",
    ],
    notes: "Analytics come from the YouTube Data and Analytics APIs after you authorize the channel.",
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    mark: "IG",
    accent: "#e1306c",
    handlePrefix: "@",
    handleLabel: "Username",
    handlePlaceholder: "yourhandle",
    description: "Reach, impressions, saves and content performance.",
    metrics: [
      "followers",
      "following",
      "reach",
      "impressions",
      "likes",
      "comments",
      "saves",
      "shares",
      "videoViews",
      "profileViews",
      "posts",
      "engagement",
      "engagementRate",
    ],
    notes: "Requires an Instagram Business or Creator account. Personal accounts cannot expose insights.",
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    mark: "in",
    accent: "#0a66c2",
    handlePrefix: "",
    handleLabel: "Profile or page",
    handlePlaceholder: "your-company",
    description: "Follower growth, impressions and post engagement.",
    metrics: [
      "followers",
      "impressions",
      "likes",
      "comments",
      "shares",
      "posts",
      "engagement",
      "engagementRate",
    ],
    notes: "Organization pages expose the richest analytics; personal profiles are limited by LinkedIn.",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    mark: "TT",
    accent: "#25f4ee",
    handlePrefix: "@",
    handleLabel: "Username",
    handlePlaceholder: "creator",
    description: "Video views, engagement and audience growth.",
    metrics: [
      "followers",
      "following",
      "videoViews",
      "views",
      "likes",
      "comments",
      "shares",
      "profileViews",
      "posts",
      "engagement",
      "engagementRate",
    ],
    notes: "Only the authorizing creator's own videos are readable.",
  },
  twitter: {
    id: "twitter",
    name: "X",
    mark: "X",
    accent: "#8b93a7",
    handlePrefix: "@",
    handleLabel: "Handle",
    handlePlaceholder: "handle",
    description: "Posts, impressions, replies and reposts.",
    metrics: [
      "followers",
      "following",
      "impressions",
      "likes",
      "comments",
      "shares",
      "posts",
      "engagement",
      "engagementRate",
    ],
    notes: "Impression counts are only returned for posts owned by the authorized account.",
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    mark: "f",
    accent: "#1877f2",
    handlePrefix: "",
    handleLabel: "Page name",
    handlePlaceholder: "your-page",
    description: "Page reach, impressions and post engagement.",
    metrics: [
      "followers",
      "reach",
      "impressions",
      "likes",
      "comments",
      "shares",
      "videoViews",
      "posts",
      "engagement",
      "engagementRate",
    ],
    notes: "Facebook Pages only — personal profiles are not supported by the platform API.",
  },
};

export const PLATFORMS = base;
export const PLATFORM_LIST: PlatformDescriptor[] = Object.values(base);
export const PLATFORM_IDS = Object.keys(base) as PlatformId[];

export function platformOf(id: string): PlatformDescriptor | undefined {
  return base[id as PlatformId];
}

export function platformName(id: string): string {
  return base[id as PlatformId]?.name ?? id;
}

export function supportsMetric(id: string, metric: MetricKey): boolean {
  return base[id as PlatformId]?.metrics.includes(metric) ?? false;
}
