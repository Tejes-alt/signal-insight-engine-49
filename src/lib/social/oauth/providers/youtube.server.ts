/**
 * YouTube integration — Google OAuth + YouTube Data API v3 + YouTube Analytics.
 * Server-only. Read-only scopes.
 */

import type { JsonObject } from "@/lib/json";
import { integrationConfig, youtubePublicKey } from "../config.server";
import { buildAuthUrl, expiryFromSeconds, form, iso, requestJson } from "../http.server";
import {
  absent,
  IntegrationNotConfiguredError,
  value,
  type AuthorizeRequest,
  type CallbackRequest,
  type DiscoveredAccount,
  type ProviderAccount,
  type ProviderAnalytics,
  type ProviderContentItem,
  type SocialProvider,
  type StoredMetrics,
  type TokenSet,
} from "../types";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

function config() {
  const cfg = integrationConfig("youtube");
  if (!cfg) throw new IntegrationNotConfiguredError("youtube", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
  return cfg;
}

interface ChannelResponse {
  items?: {
    id: string;
    snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url?: string } } };
    statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }[];
}

async function channel(token: TokenSet): Promise<NonNullable<ChannelResponse["items"]>[number]> {
  const data = await requestJson<ChannelResponse>(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true",
    { platformName: "YouTube", headers: { Authorization: `Bearer ${token.accessToken}` } },
  );
  const item = data.items?.[0];
  if (!item) throw new Error("No YouTube channel is attached to the authorized account.");
  return item;
}

export const youtubeProvider: SocialProvider = {
  id: "youtube",
  requiredSecrets: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  capabilities: [
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

  async discoverAccount(hint) {
    const key = youtubePublicKey();
    const handle = hint.handle?.replace(/^@/, "").trim();
    if (!key || !handle) return null;
    try {
      const data = await requestJson<ChannelResponse>(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(handle)}&key=${key}`,
        { platformName: "YouTube" },
      );
      const item = data.items?.[0];
      if (!item) return null;
      return {
        platform: "youtube",
        handle: item.snippet.customUrl ?? `@${handle}`,
        displayName: item.snippet.title,
        avatarUrl: item.snippet.thumbnails?.default?.url ?? null,
        profileUrl: `https://www.youtube.com/${item.snippet.customUrl ?? `@${handle}`}`,
        confidence: "possible",
        source: "public_directory",
      } satisfies DiscoveredAccount;
    } catch {
      return null;
    }
  },

  async connect(req: AuthorizeRequest) {
    const cfg = config();
    return {
      url: buildAuthUrl("https://accounts.google.com/o/oauth2/v2/auth", {
        client_id: cfg.clientId,
        redirect_uri: req.redirectUri,
        response_type: "code",
        scope: SCOPES.join(" "),
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent",
        state: req.state,
      }),
    };
  },

  async callback(req: CallbackRequest) {
    const cfg = config();
    const data = await requestJson<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    }>("https://oauth2.googleapis.com/token", {
      platformName: "YouTube",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        code: req.code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: req.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: expiryFromSeconds(data.expires_in),
      scopes: data.scope?.split(" ") ?? SCOPES,
    };
  },

  async refresh(token: TokenSet) {
    if (!token.refreshToken) return null;
    const cfg = config();
    const data = await requestJson<{ access_token: string; expires_in?: number; scope?: string }>(
      "https://oauth2.googleapis.com/token",
      {
        platformName: "YouTube",
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form({
          refresh_token: token.refreshToken,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          grant_type: "refresh_token",
        }),
      },
    );
    return {
      accessToken: data.access_token,
      refreshToken: token.refreshToken,
      expiresAt: expiryFromSeconds(data.expires_in),
      scopes: data.scope?.split(" ") ?? token.scopes,
    };
  },

  async getAccount(token: TokenSet): Promise<ProviderAccount> {
    const item = await channel(token);
    return {
      externalId: item.id,
      handle: item.snippet.customUrl ?? null,
      displayName: item.snippet.title,
      avatarUrl: item.snippet.thumbnails?.default?.url ?? null,
      profileUrl: `https://www.youtube.com/channel/${item.id}`,
      metadata: {
        uploadsPlaylist: item.contentDetails?.relatedPlaylists?.uploads ?? null,
      } as JsonObject,
    };
  },

  async getAnalytics(token: TokenSet): Promise<ProviderAnalytics> {
    const item = await channel(token);
    const stats = item.statistics ?? {};
    const metrics: StoredMetrics = {};
    if (stats.subscriberCount !== undefined) {
      metrics.subscriberCount = value(Number(stats.subscriberCount));
      metrics.followers = value(Number(stats.subscriberCount));
    }
    if (stats.viewCount !== undefined) metrics.views = value(Number(stats.viewCount));
    if (stats.videoCount !== undefined) metrics.posts = value(Number(stats.videoCount));

    const history: ProviderAnalytics["history"] = [];
    const end = new Date();
    const start = new Date(Date.now() - 365 * 86400000);
    try {
      const report = await requestJson<{ rows?: (string | number)[][]; columnHeaders?: { name: string }[] }>(
        `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE&startDate=${iso(start)}&endDate=${iso(end)}&metrics=views,estimatedMinutesWatched,likes,comments,shares,subscribersGained,subscribersLost&dimensions=day&sort=day`,
        { platformName: "YouTube", headers: { Authorization: `Bearer ${token.accessToken}` } },
      );
      const headers = (report.columnHeaders ?? []).map((h) => h.name);
      let likes = 0;
      let comments = 0;
      let shares = 0;
      let watch = 0;
      let periodViews = 0;
      for (const row of report.rows ?? []) {
        const get = (name: string) => {
          const i = headers.indexOf(name);
          return i >= 0 ? Number(row[i] ?? 0) : 0;
        };
        const day = String(row[headers.indexOf("day")] ?? "");
        const dayMetrics: StoredMetrics = {
          views: value(get("views")),
          likes: value(get("likes")),
          comments: value(get("comments")),
          shares: value(get("shares")),
          watchTime: value(get("estimatedMinutesWatched")),
          engagement: value(get("likes") + get("comments") + get("shares")),
        };
        likes += get("likes");
        comments += get("comments");
        shares += get("shares");
        watch += get("estimatedMinutesWatched");
        periodViews += get("views");
        if (day) history.push({ date: day, metrics: dayMetrics });
      }
      metrics.likes = value(likes);
      metrics.comments = value(comments);
      metrics.shares = value(shares);
      metrics.watchTime = value(watch);
      metrics.videoViews = value(periodViews);
      const engagement = likes + comments + shares;
      metrics.engagement = value(engagement);
      metrics.engagementRate =
        periodViews > 0
          ? value(Number(((engagement / periodViews) * 100).toFixed(2)))
          : absent("unavailable", "Needs views in the selected period.");
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "YouTube analytics could not be retrieved for this channel.";
      metrics.watchTime = absent("not_authorized", reason);
    }

    metrics.reach = absent("not_supported", "YouTube does not report reach.");
    metrics.impressions = absent("not_supported", "Impression data is not exposed by the YouTube API.");
    metrics.saves = absent("not_supported", "YouTube does not report saves.");
    return { metrics, history };
  },

  async getContent(token: TokenSet, account: ProviderAccount): Promise<ProviderContentItem[]> {
    const uploads = (account.metadata as { uploadsPlaylist?: string | null }).uploadsPlaylist;
    if (!uploads) return [];
    const playlist = await requestJson<{
      items?: { contentDetails: { videoId: string } }[];
    }>(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}`,
      { platformName: "YouTube", headers: { Authorization: `Bearer ${token.accessToken}` } },
    );
    const ids = (playlist.items ?? []).map((i) => i.contentDetails.videoId).filter(Boolean);
    if (ids.length === 0) return [];
    const videos = await requestJson<{
      items?: {
        id: string;
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          thumbnails?: { medium?: { url?: string } };
        };
        statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
      }[];
    }>(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids.join(",")}`,
      { platformName: "YouTube", headers: { Authorization: `Bearer ${token.accessToken}` } },
    );
    return (videos.items ?? []).map((v) => {
      const stats = v.statistics ?? {};
      const likes = stats.likeCount === undefined ? null : Number(stats.likeCount);
      const comments = stats.commentCount === undefined ? null : Number(stats.commentCount);
      const views = stats.viewCount === undefined ? null : Number(stats.viewCount);
      const metrics: StoredMetrics = {
        views: views === null ? absent("unavailable", "Hidden by the channel owner.") : value(views),
        likes: likes === null ? absent("unavailable", "Hidden by the channel owner.") : value(likes),
        comments: comments === null ? absent("unavailable", "Comments are disabled.") : value(comments),
        shares: absent("not_supported", "Per-video share counts are not exposed."),
        saves: absent("not_supported", "YouTube does not report saves."),
        reach: absent("not_supported", "YouTube does not report reach."),
        impressions: absent("not_supported", "Impressions are not exposed for individual videos."),
      };
      const engagement = (likes ?? 0) + (comments ?? 0);
      metrics.engagement = value(engagement);
      metrics.engagementRate =
        views && views > 0
          ? value(Number(((engagement / views) * 100).toFixed(2)))
          : absent("unavailable", "Needs a view count.");
      return {
        externalId: v.id,
        title: v.snippet.title,
        caption: v.snippet.description?.slice(0, 500) ?? null,
        mediaType: "video",
        thumbnailUrl: v.snippet.thumbnails?.medium?.url ?? null,
        permalink: `https://www.youtube.com/watch?v=${v.id}`,
        publishedAt: v.snippet.publishedAt,
        metrics,
      };
    });
  },

  async getContentAnalytics(_token, _account, items) {
    // Video statistics already arrive with the content payload.
    return items;
  },

  async disconnect(token: TokenSet) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token.accessToken)}`, {
        method: "POST",
      });
    } catch {
      // Revocation is best effort; the stored credential is deleted regardless.
    }
  },
};
