/**
 * Normalized analytics model for SocialPulse.
 *
 * Every figure the UI renders is a `NormalizedMetric`. When a platform, the
 * provider plan, or the granted permissions cannot supply a number, the metric
 * carries the reason instead of a fabricated value. Nothing here ever invents
 * data.
 */

export type MetricStatus = "available" | "unavailable" | "not_authorized" | "not_supported";

export interface NormalizedMetric {
  value: number | null;
  status: MetricStatus;
  reason?: string | undefined;
}

export const ok = (value: number): NormalizedMetric => ({ value, status: "available" });
export const missing = (
  status: Exclude<MetricStatus, "available">,
  reason: string,
): NormalizedMetric => ({ value: null, status, reason });

export const METRIC_KEYS = [
  "followers",
  "following",
  "views",
  "reach",
  "impressions",
  "likes",
  "comments",
  "shares",
  "saves",
  "engagement",
  "engagementRate",
  "posts",
  "videoViews",
  "profileViews",
  "watchTime",
  "subscriberCount",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const METRIC_LABELS: Record<MetricKey, string> = {
  followers: "Followers",
  following: "Following",
  views: "Views",
  reach: "Reach",
  impressions: "Impressions",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  engagement: "Engagement",
  engagementRate: "Engagement rate",
  posts: "Posts",
  videoViews: "Video views",
  profileViews: "Profile views",
  watchTime: "Watch time",
  subscriberCount: "Subscribers",
};

export type MetricSet = Record<MetricKey, NormalizedMetric>;

export const MISSING_REASON_LABELS: Record<Exclude<MetricStatus, "available">, string> = {
  unavailable: "Not available yet",
  not_authorized: "Permission not granted",
  not_supported: "Not available for this platform",
};

export interface SyncState {
  status: "idle" | "queued" | "syncing" | "synced" | "error";
  lastSyncedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export type ConnectionStatus =
  | "pending"
  | "connected"
  | "syncing"
  | "synced"
  | "needs_reconnect"
  | "permission_error"
  | "unavailable";

export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  pending: "Awaiting authorization",
  connected: "Connected",
  syncing: "Syncing",
  synced: "Synced",
  needs_reconnect: "Needs reconnection",
  permission_error: "Permission error",
  unavailable: "Unavailable",
};
