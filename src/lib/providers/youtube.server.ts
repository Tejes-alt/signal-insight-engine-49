/**
 * YouTube adapter — official YouTube Data API v3.
 *
 * Server-only. Public-source mode uses a server-held API key (never sent to the
 * browser) and reads only data the API exposes publicly. No scraping.
 */

import type {
  FetchResult,
  NormalizedAccount,
  NormalizedComment,
  NormalizedPost,
} from "./normalized";
import { detectLanguage, extractHashtags, extractMentions } from "../analytics/text";

const API = "https://www.googleapis.com/youtube/v3";

export class ProviderError extends Error {
  code: string;
  detail: string | undefined;
  constructor(code: string, message: string, detail?: string) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

function apiKey(): string {
  const key = process.env["YOUTUBE_API_KEY"];
  if (!key) {
    throw new ProviderError(
      "provider_not_configured",
      "YouTube is not configured yet. A YouTube Data API key must be stored as a server secret before sources can be synchronized.",
    );
  }
  return key;
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", apiKey());

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let reason = "";
    try {
      reason = JSON.parse(body)?.error?.errors?.[0]?.reason ?? "";
    } catch {
      /* keep raw */
    }
    if (res.status === 403 && (reason === "quotaExceeded" || reason === "rateLimitExceeded")) {
      throw new ProviderError(
        "rate_limited",
        "YouTube API quota exhausted for today. Synchronization will resume when the quota resets at midnight Pacific time.",
      );
    }
    if (res.status === 400 || res.status === 403) {
      throw new ProviderError(
        "provider_rejected",
        "YouTube rejected the request. The API key may be invalid or missing YouTube Data API v3 access.",
        reason,
      );
    }
    if (res.status === 404) throw new ProviderError("not_found", "YouTube returned no such resource.");
    throw new ProviderError("provider_error", `YouTube API error (${res.status}).`, reason);
  }
  return (await res.json()) as T;
}

interface ChannelItem {
  id: string;
  snippet: {
    title: string;
    customUrl?: string;
    thumbnails?: { high?: { url: string }; default?: { url: string } };
    country?: string;
    publishedAt?: string;
    description?: string;
  };
  statistics: { subscriberCount?: string; videoCount?: string; viewCount?: string; hiddenSubscriberCount?: boolean };
  contentDetails: { relatedPlaylists: { uploads: string } };
}

/** Accepts a channel ID, @handle, bare handle, or any youtube.com URL. */
export function parseChannelInput(input: string): { kind: "id" | "handle"; value: string } {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/youtube\.com\/(channel\/)?(@?[\w.-]+)/i);
  const token = urlMatch ? (urlMatch[1] ? urlMatch[2]! : urlMatch[2]!) : trimmed;
  const clean = token.replace(/^\/+/, "");
  if (/^UC[\w-]{20,}$/.test(clean)) return { kind: "id", value: clean };
  return { kind: "handle", value: clean.replace(/^@/, "") };
}

export async function resolveChannel(input: string): Promise<NormalizedAccount> {
  const parsed = parseChannelInput(input);
  const params: Record<string, string> = {
    part: "snippet,statistics,contentDetails",
  };
  if (parsed.kind === "id") params["id"] = parsed.value;
  else params["forHandle"] = `@${parsed.value}`;

  let data = await call<{ items?: ChannelItem[] }>("channels", params);

  // Legacy vanity names are not resolvable via forHandle; fall back to search.
  if (!data.items?.length && parsed.kind === "handle") {
    const search = await call<{ items?: { snippet: { channelId: string } }[] }>("search", {
      part: "snippet",
      type: "channel",
      maxResults: "1",
      q: parsed.value,
    });
    const channelId = search.items?.[0]?.snippet.channelId;
    if (channelId) {
      data = await call<{ items?: ChannelItem[] }>("channels", {
        part: "snippet,statistics,contentDetails",
        id: channelId,
      });
    }
  }

  const item = data.items?.[0];
  if (!item) {
    throw new ProviderError(
      "not_found",
      `No YouTube channel matched "${input}". Try the channel URL or its UC… channel ID.`,
    );
  }

  return {
    provider: "youtube",
    externalId: item.id,
    handle: item.snippet.customUrl ?? null,
    displayName: item.snippet.title,
    avatarUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url ?? null,
    followers: item.statistics.hiddenSubscriberCount
      ? null
      : Number(item.statistics.subscriberCount ?? 0),
    metadata: {
      uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
      country: item.snippet.country ?? null,
      videoCount: Number(item.statistics.videoCount ?? 0),
      channelViews: Number(item.statistics.viewCount ?? 0),
      description: (item.snippet.description ?? "").slice(0, 400),
      followersHidden: Boolean(item.statistics.hiddenSubscriberCount),
    },
  };
}

interface VideoItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    defaultAudioLanguage?: string;
    tags?: string[];
    thumbnails?: { medium?: { url: string }; default?: { url: string } };
    liveBroadcastContent?: string;
  };
  statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}

function toPost(video: VideoItem, handle: string | null): NormalizedPost {
  const text = `${video.snippet.title}\n\n${video.snippet.description ?? ""}`.trim();
  const tagHashtags = (video.snippet.tags ?? []).map((t) => `#${t.replace(/\s+/g, "").toLowerCase()}`);
  const duration = video.contentDetails?.duration ?? "";
  const seconds = parseIsoDuration(duration);
  return {
    provider: "youtube",
    providerPostId: video.id,
    authorId: video.snippet.channelId,
    authorName: video.snippet.channelTitle,
    authorHandle: handle,
    title: video.snippet.title,
    text,
    language: video.snippet.defaultAudioLanguage ?? detectLanguage(text),
    location: null,
    publishedAt: video.snippet.publishedAt,
    mediaType: seconds !== null && seconds > 0 && seconds <= 60 ? "short" : "video",
    permalink: `https://www.youtube.com/watch?v=${video.id}`,
    thumbnailUrl: video.snippet.thumbnails?.medium?.url ?? video.snippet.thumbnails?.default?.url ?? null,
    hashtags: Array.from(new Set([...extractHashtags(text), ...tagHashtags])).slice(0, 30),
    mentions: extractMentions(text),
    likes: video.statistics.likeCount !== undefined ? Number(video.statistics.likeCount) : null,
    commentsCount:
      video.statistics.commentCount !== undefined ? Number(video.statistics.commentCount) : null,
    // YouTube's public API exposes no share metric; only channel owners see it
    // in YouTube Analytics. Recording null + provenance instead of faking 0.
    shares: null,
    views: video.statistics.viewCount !== undefined ? Number(video.statistics.viewCount) : null,
    replies: null,
    metricProvenance: {
      likes: video.statistics.likeCount !== undefined ? "provider" : "requires_authorization",
      views: video.statistics.viewCount !== undefined ? "provider" : "requires_authorization",
      commentsCount: video.statistics.commentCount !== undefined ? "provider" : "requires_authorization",
      shares: "requires_authorization",
      replies: "unsupported",
    },
    raw: { durationSeconds: seconds, live: video.snippet.liveBroadcastContent ?? "none" },
  };
}

function parseIsoDuration(value: string): number | null {
  const m = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export interface FetchUploadsOptions {
  uploadsPlaylistId: string;
  handle: string | null;
  /** Only keep items newer than this ISO timestamp (incremental sync). */
  since?: string | null;
  maxItems?: number;
  includeComments?: boolean;
  commentsPerPost?: number;
}

export async function fetchUploads(options: FetchUploadsOptions): Promise<FetchResult> {
  const maxItems = Math.min(options.maxItems ?? 50, 200);
  const ids: string[] = [];
  let pageToken: string | undefined;
  let reachedCursor = false;

  while (ids.length < maxItems && !reachedCursor) {
    const page = await call<{
      items?: { contentDetails: { videoId: string; videoPublishedAt?: string } }[];
      nextPageToken?: string;
    }>("playlistItems", {
      part: "contentDetails",
      playlistId: options.uploadsPlaylistId,
      maxResults: String(Math.min(50, maxItems - ids.length)),
      ...(pageToken ? { pageToken } : {}),
    });

    for (const item of page.items ?? []) {
      const publishedAt = item.contentDetails.videoPublishedAt;
      if (options.since && publishedAt && new Date(publishedAt) <= new Date(options.since)) {
        reachedCursor = true;
        break;
      }
      ids.push(item.contentDetails.videoId);
    }
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }

  const posts: NormalizedPost[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const data = await call<{ items?: VideoItem[] }>("videos", {
      part: "snippet,statistics,contentDetails",
      id: chunk.join(","),
    });
    for (const v of data.items ?? []) posts.push(toPost(v, options.handle));
  }

  const comments: NormalizedComment[] = [];
  if (options.includeComments) {
    const perPost = Math.min(options.commentsPerPost ?? 20, 100);
    // Comments are the highest-signal sentiment source, so pull them for the
    // most recent uploads only — quota is a finite resource.
    for (const post of posts.slice(0, 10)) {
      try {
        const data = await call<{
          items?: {
            id: string;
            snippet: {
              topLevelComment: {
                snippet: {
                  authorDisplayName: string;
                  textOriginal: string;
                  likeCount: number;
                  publishedAt: string;
                };
              };
            };
          }[];
        }>("commentThreads", {
          part: "snippet",
          videoId: post.providerPostId,
          maxResults: String(perPost),
          order: "relevance",
          textFormat: "plainText",
        });
        for (const t of data.items ?? []) {
          const s = t.snippet.topLevelComment.snippet;
          comments.push({
            provider: "youtube",
            providerCommentId: t.id,
            providerPostId: post.providerPostId,
            authorName: s.authorDisplayName,
            authorHandle: null,
            text: s.textOriginal,
            likes: s.likeCount,
            publishedAt: s.publishedAt,
          });
        }
      } catch (error) {
        // Creators can disable comments per video — that is not a sync failure.
        if (error instanceof ProviderError && error.code === "rate_limited") throw error;
      }
    }
  }

  const newest = posts.reduce<string | null>(
    (acc, p) => (!acc || p.publishedAt > acc ? p.publishedAt : acc),
    null,
  );

  return { posts, comments, cursor: newest, quotaNote: `${ids.length} uploads inspected` };
}
