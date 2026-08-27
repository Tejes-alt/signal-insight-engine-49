/**
 * Public-data model for SocialPulse.
 *
 * Everything here is client-safe: descriptive types only, no network calls and
 * no secrets. SocialPulse never asks a user for a social password, an API key
 * or a developer credential — it only reads information a platform publishes
 * openly, and marks everything else as needing account authorization.
 */

import type { PlatformId } from "../social/platforms";

export type { PlatformId };

/** Metrics SocialPulse can, in principle, read from a public profile. */
export const PUBLIC_METRIC_KEYS = [
  "followers",
  "following",
  "posts",
  "views",
  "likes",
  "comments",
] as const;
export type PublicMetricKey = (typeof PUBLIC_METRIC_KEYS)[number];

export const PUBLIC_METRIC_LABELS: Record<PublicMetricKey, string> = {
  followers: "Followers",
  following: "Following",
  posts: "Content",
  views: "Public views",
  likes: "Public likes",
  comments: "Public comments",
};

/** Metrics no platform publishes openly — they always require authorization. */
export const PRIVATE_METRIC_LABELS = [
  "Reach",
  "Impressions",
  "Saves",
  "Audience demographics",
] as const;

export type AccountStatus = "available" | "partial" | "not_found" | "unavailable" | "pending";

export interface PublicMetrics {
  followers?: number | null;
  following?: number | null;
  posts?: number | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
}

export interface PublicProfile {
  handle: string;
  externalId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  profileUrl: string;
}

export interface PublicContentItem {
  externalId: string;
  title?: string | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
}

export interface ContentRow extends PublicContentItem {
  platform: PlatformId;
  accountHandle: string;
}

export interface SnapshotPoint {
  id?: string;
  /** Where this measurement came from: public, manual, import or screenshot. */
  source?: string;
  capturedAt: string;
  followers: number | null;
  posts: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
}

export interface GrowthSummary {
  /** null until at least two real snapshots exist. */
  delta: number | null;
  percent: number | null;
  perWeek: number | null;
  trackedSinceDays: number;
  snapshotCount: number;
  note: string;
}

export interface PublicAccountView {
  id: string;
  platform: PlatformId;
  handle: string;
  profileUrl: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  status: AccountStatus;
  statusMessage: string | null;
  firstTrackedAt: string;
  lastCheckedAt: string | null;
  metrics: PublicMetrics;
  /** Which public metrics were actually retrieved for this account. */
  retrieved: PublicMetricKey[];
  engagementRate: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  avgViews: number | null;
  postsPerWeek: number | null;
  growth: GrowthSummary;
  history: SnapshotPoint[];
  content: ContentRow[];
}

export interface Insight {
  id: string;
  title: string;
  detail: string;
  tone: "positive" | "neutral" | "info";
}

export interface OverviewBundle {
  accounts: PublicAccountView[];
  totals: {
    followers: number | null;
    content: number | null;
    publicEngagement: number | null;
    avgEngagementRate: number | null;
    followerGrowth: number | null;
  };
  topPlatform: { platform: PlatformId; followers: number } | null;
  topContent: ContentRow | null;
  followerSeries: { date: string; total: number }[];
  engagementSeries: { date: string; value: number }[];
  postingFrequency: { week: string; count: number }[];
  insights: Insight[];
  lastCheckedAt: string | null;
  hasHistory: boolean;
}

/** Human wording for a status — never technical. */
export const STATUS_COPY: Record<AccountStatus, { label: string; hint: string }> = {
  pending: { label: "Checking…", hint: "Looking up this profile." },
  available: { label: "Public profile connected", hint: "Public information is up to date." },
  partial: {
    label: "Public profile connected",
    hint: "Some private analytics require platform authorization.",
  },
  not_found: { label: "Couldn't find this account", hint: "Check the username and try again." },
  unavailable: {
    label: "Public data isn't currently available",
    hint: "This platform isn't sharing public information right now. You can still track your other accounts.",
  },
};
