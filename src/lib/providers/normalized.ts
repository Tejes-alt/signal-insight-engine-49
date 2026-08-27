/**
 * The canonical internal event model. Every provider adapter maps into this
 * shape. Fields a provider cannot supply are `null` — never zero — and the
 * reason is recorded in `metricProvenance` so the UI can explain the gap.
 */

import type { JsonObject, JsonValue } from "../json";

export type MetricSource = "provider" | "derived" | "unsupported" | "requires_authorization";

export interface NormalizedPost {
  provider: string;
  providerPostId: string;
  authorId: string | null;
  authorName: string | null;
  authorHandle: string | null;
  title: string | null;
  text: string | null;
  language: string | null;
  location: string | null;
  publishedAt: string; // ISO
  mediaType: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  hashtags: string[];
  mentions: string[];
  likes: number | null;
  commentsCount: number | null;
  shares: number | null;
  views: number | null;
  replies: number | null;
  metricProvenance: Record<string, MetricSource>;
  raw?: JsonValue | undefined;
}

export interface NormalizedComment {
  provider: string;
  providerCommentId: string;
  providerPostId: string;
  authorName: string | null;
  authorHandle: string | null;
  text: string | null;
  likes: number | null;
  publishedAt: string;
}

export interface NormalizedAccount {
  provider: string;
  externalId: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  followers: number | null;
  metadata: JsonObject;
}

export interface FetchResult {
  posts: NormalizedPost[];
  comments: NormalizedComment[];
  cursor: string | null;
  /** Provider-reported rate limit / quota information, when available. */
  quotaNote?: string | undefined;
}
