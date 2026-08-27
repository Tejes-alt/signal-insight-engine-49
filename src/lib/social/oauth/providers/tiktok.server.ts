/**
 * TikTok integration — TikTok Login Kit (v2) + Display API. Server-only.
 */

import type { JsonObject } from "@/lib/json";
import { integrationConfig } from "../config.server";
import { buildAuthUrl, expiryFromSeconds, form, requestJson } from "../http.server";
import {
  absent,
  IntegrationNotConfiguredError,
  value,
  type AuthorizeRequest,
  type CallbackRequest,
  type ProviderAccount,
  type ProviderAnalytics,
  type ProviderContentItem,
  type SocialProvider,
  type StoredMetrics,
  type TokenSet,
} from "../types";

const SCOPES = ["user.info.basic", "user.info.profile", "user.info.stats", "video.list"];

function config() {
  const cfg = integrationConfig("tiktok");
  if (!cfg) throw new IntegrationNotConfiguredError("tiktok", ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"]);
  return cfg;
}

export const tiktokProvider: SocialProvider = {
  id: "tiktok",
  requiredSecrets: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
  capabilities: [
    "followers",
    "following",
    "likes",
    "comments",
    "shares",
    "views",
    "videoViews",
    "posts",
    "profileViews",
    "engagement",
    "engagementRate",
  ],

  async discoverAccount(hint) {
    const handle = hint.handle?.replace(/^@/, "").trim();
    if (!handle) return null;
    return {
      platform: "tiktok",
      handle,
      displayName: null,
      avatarUrl: null,
      profileUrl: `https://www.tiktok.com/@${handle}`,
      confidence: "possible",
      source: "manual",
    };
  },

  async connect(req: AuthorizeRequest) {
    const cfg = config();
    return {
      url: buildAuthUrl("https://www.tiktok.com/v2/auth/authorize/", {
        client_key: cfg.clientId,
        response_type: "code",
        scope: SCOPES.join(","),
        redirect_uri: req.redirectUri,
        state: req.state,
        code_challenge: req.codeVerifier,
        code_challenge_method: "plain",
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
      open_id?: string;
    }>("https://open.tiktokapis.com/v2/oauth/token/", {
      platformName: "TikTok",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        client_key: cfg.clientId,
        client_secret: cfg.clientSecret,
        code: req.code,
        grant_type: "authorization_code",
        redirect_uri: req.redirectUri,
        ...(req.codeVerifier ? { code_verifier: req.codeVerifier } : {}),
      }),
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: expiryFromSeconds(data.expires_in),
      scopes: data.scope?.split(",") ?? SCOPES,
      metadata: { openId: data.open_id ?? null } as JsonObject,
    };
  },

  async refresh(token: TokenSet) {
    if (!token.refreshToken) return null;
    const cfg = config();
    const data = await requestJson<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    }>("https://open.tiktokapis.com/v2/oauth/token/", {
      platformName: "TikTok",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        client_key: cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: expiryFromSeconds(data.expires_in),
      scopes: data.scope?.split(",") ?? token.scopes,
    };
  },

  async getAccount(token: TokenSet): Promise<ProviderAccount> {
    const data = await requestJson<{
      data?: {
        user?: {
          open_id: string;
          display_name?: string;
          username?: string;
          avatar_url?: string;
          follower_count?: number;
          following_count?: number;
          likes_count?: number;
          video_count?: number;
          profile_deep_link?: string;
        };
      };
    }>(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,avatar_url,follower_count,following_count,likes_count,video_count,profile_deep_link",
      { platformName: "TikTok", headers: { Authorization: `Bearer ${token.accessToken}` } },
    );
    const user = data.data?.user;
    if (!user) throw new Error("TikTok did not return the authorized account.");
    return {
      externalId: user.open_id,
      handle: user.username ?? null,
      displayName: user.display_name ?? null,
      avatarUrl: user.avatar_url ?? null,
      profileUrl: user.profile_deep_link ?? (user.username ? `https://www.tiktok.com/@${user.username}` : null),
      metadata: {
        followers: user.follower_count ?? null,
        following: user.following_count ?? null,
        likes: user.likes_count ?? null,
        videos: user.video_count ?? null,
      } as JsonObject,
    };
  },

  async getAnalytics(_token, account: ProviderAccount): Promise<ProviderAnalytics> {
    const meta = account.metadata as {
      followers?: number | null;
      following?: number | null;
      likes?: number | null;
      videos?: number | null;
    };
    const metrics: StoredMetrics = {};
    if (meta.followers != null) metrics.followers = value(meta.followers);
    if (meta.following != null) metrics.following = value(meta.following);
    if (meta.likes != null) metrics.likes = value(meta.likes);
    if (meta.videos != null) metrics.posts = value(meta.videos);
    metrics.reach = absent("not_supported", "TikTok does not expose reach through its public API.");
    metrics.impressions = absent("not_supported", "TikTok reports video views rather than impressions.");
    metrics.profileViews = absent("not_authorized", "Profile views require TikTok's Analytics scope approval.");
    return { metrics, history: [] };
  },

  async getContent(token: TokenSet): Promise<ProviderContentItem[]> {
    const data = await requestJson<{
      data?: {
        videos?: {
          id: string;
          title?: string;
          video_description?: string;
          cover_image_url?: string;
          share_url?: string;
          create_time?: number;
          like_count?: number;
          comment_count?: number;
          share_count?: number;
          view_count?: number;
        }[];
      };
    }>(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,cover_image_url,share_url,create_time,like_count,comment_count,share_count,view_count",
      {
        platformName: "TikTok",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ max_count: 20 }),
      },
    );
    return (data.data?.videos ?? []).map((v) => {
      const likes = v.like_count ?? null;
      const comments = v.comment_count ?? null;
      const shares = v.share_count ?? null;
      const views = v.view_count ?? null;
      const engagement = (likes ?? 0) + (comments ?? 0) + (shares ?? 0);
      const metrics: StoredMetrics = {
        likes: likes === null ? absent("unavailable", "Not returned for this video.") : value(likes),
        comments: comments === null ? absent("unavailable", "Not returned for this video.") : value(comments),
        shares: shares === null ? absent("unavailable", "Not returned for this video.") : value(shares),
        views: views === null ? absent("unavailable", "Not returned for this video.") : value(views),
        engagement: value(engagement),
        engagementRate:
          views && views > 0
            ? value(Number(((engagement / views) * 100).toFixed(2)))
            : absent("unavailable", "Needs a view count."),
      };
      return {
        externalId: v.id,
        title: v.title || v.video_description?.slice(0, 90) || null,
        caption: v.video_description ?? null,
        mediaType: "video",
        thumbnailUrl: v.cover_image_url ?? null,
        permalink: v.share_url ?? null,
        publishedAt: new Date((v.create_time ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        metrics,
      };
    });
  },

  async getContentAnalytics(_token, _account, items) {
    return items;
  },

  async disconnect(token: TokenSet) {
    try {
      const cfg = config();
      await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form({ client_key: cfg.clientId, client_secret: cfg.clientSecret, token: token.accessToken }),
      });
    } catch {
      // Best effort.
    }
  },
};
