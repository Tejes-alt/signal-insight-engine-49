/**
 * X (Twitter) integration — OAuth 2.0 with PKCE + the X API v2. Server-only.
 */

import type { JsonObject } from "@/lib/json";
import { integrationConfig } from "../config.server";
import { buildAuthUrl, expiryFromSeconds, form, requestJson } from "../http.server";
import {
  absent,
  IntegrationNotConfiguredError,
  pkceUnsupportedNote,
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
import { pkceChallenge } from "../crypto.server";

const SCOPES = ["tweet.read", "users.read", "offline.access"];

function config() {
  const cfg = integrationConfig("twitter");
  if (!cfg) throw new IntegrationNotConfiguredError("twitter", ["X_CLIENT_ID", "X_CLIENT_SECRET"]);
  return cfg;
}

function basicAuth(): string {
  const cfg = config();
  return Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
}

export const xProvider: SocialProvider = {
  id: "twitter",
  requiredSecrets: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
  capabilities: ["followers", "following", "likes", "comments", "shares", "impressions", "posts", "engagement", "engagementRate"],

  async discoverAccount(hint) {
    const handle = hint.handle?.replace(/^@/, "").trim();
    if (!handle) return null;
    return {
      platform: "twitter",
      handle,
      displayName: null,
      avatarUrl: null,
      profileUrl: `https://x.com/${handle}`,
      confidence: "possible",
      source: "manual",
    };
  },

  async connect(req: AuthorizeRequest) {
    const cfg = config();
    return {
      url: buildAuthUrl("https://twitter.com/i/oauth2/authorize", {
        response_type: "code",
        client_id: cfg.clientId,
        redirect_uri: req.redirectUri,
        scope: SCOPES.join(" "),
        state: req.state,
        code_challenge: pkceChallenge(req.codeVerifier),
        code_challenge_method: "S256",
      }),
    };
  },

  async callback(req: CallbackRequest) {
    const data = await requestJson<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    }>("https://api.twitter.com/2/oauth2/token", {
      platformName: "X",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth()}`,
      },
      body: form({
        grant_type: "authorization_code",
        code: req.code,
        redirect_uri: req.redirectUri,
        code_verifier: req.codeVerifier ?? "",
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
    const data = await requestJson<{ access_token: string; refresh_token?: string; expires_in?: number }>(
      "https://api.twitter.com/2/oauth2/token",
      {
        platformName: "X",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth()}`,
        },
        body: form({ grant_type: "refresh_token", refresh_token: token.refreshToken }),
      },
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: expiryFromSeconds(data.expires_in),
      scopes: token.scopes,
    };
  },

  async getAccount(token: TokenSet): Promise<ProviderAccount> {
    const data = await requestJson<{
      data?: {
        id: string;
        name?: string;
        username?: string;
        profile_image_url?: string;
        public_metrics?: {
          followers_count?: number;
          following_count?: number;
          tweet_count?: number;
        };
      };
    }>("https://api.twitter.com/2/users/me?user.fields=public_metrics,profile_image_url", {
      platformName: "X",
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    const user = data.data;
    if (!user) throw new Error("X did not return the authorized account.");
    return {
      externalId: user.id,
      handle: user.username ?? null,
      displayName: user.name ?? null,
      avatarUrl: user.profile_image_url ?? null,
      profileUrl: user.username ? `https://x.com/${user.username}` : null,
      metadata: (user.public_metrics ?? {}) as JsonObject,
    };
  },

  async getAnalytics(_token, account: ProviderAccount): Promise<ProviderAnalytics> {
    const m = account.metadata as {
      followers_count?: number;
      following_count?: number;
      tweet_count?: number;
    };
    const metrics: StoredMetrics = {};
    if (m.followers_count != null) metrics.followers = value(m.followers_count);
    if (m.following_count != null) metrics.following = value(m.following_count);
    if (m.tweet_count != null) metrics.posts = value(m.tweet_count);
    metrics.impressions = absent("not_authorized", pkceUnsupportedNote("X", "impression totals"));
    metrics.reach = absent("not_supported", "X does not report reach.");
    metrics.saves = absent("not_supported", "Bookmark counts are only available on paid API tiers.");
    return { metrics, history: [] };
  },

  async getContent(token: TokenSet, account: ProviderAccount): Promise<ProviderContentItem[]> {
    const data = await requestJson<{
      data?: {
        id: string;
        text: string;
        created_at: string;
        public_metrics?: {
          like_count?: number;
          reply_count?: number;
          retweet_count?: number;
          impression_count?: number;
          bookmark_count?: number;
        };
      }[];
    }>(
      `https://api.twitter.com/2/users/${account.externalId}/tweets?max_results=50&tweet.fields=public_metrics,created_at`,
      { platformName: "X", headers: { Authorization: `Bearer ${token.accessToken}` } },
    );
    return (data.data ?? []).map((t) => {
      const pm = t.public_metrics ?? {};
      const likes = pm.like_count ?? null;
      const replies = pm.reply_count ?? null;
      const reposts = pm.retweet_count ?? null;
      const impressions = pm.impression_count ?? null;
      const engagement = (likes ?? 0) + (replies ?? 0) + (reposts ?? 0);
      const metrics: StoredMetrics = {
        likes: likes === null ? absent("unavailable", "Not returned for this post.") : value(likes),
        comments: replies === null ? absent("unavailable", "Not returned for this post.") : value(replies),
        shares: reposts === null ? absent("unavailable", "Not returned for this post.") : value(reposts),
        impressions:
          impressions === null
            ? absent("not_authorized", pkceUnsupportedNote("X", "impressions"))
            : value(impressions),
        saves:
          pm.bookmark_count === undefined
            ? absent("not_authorized", "Bookmark counts need a paid API tier.")
            : value(pm.bookmark_count),
        engagement: value(engagement),
        engagementRate:
          impressions && impressions > 0
            ? value(Number(((engagement / impressions) * 100).toFixed(2)))
            : absent("unavailable", "Needs impression data."),
      };
      return {
        externalId: t.id,
        title: t.text.slice(0, 90),
        caption: t.text,
        mediaType: "post",
        thumbnailUrl: null,
        permalink: `https://x.com/${account.handle ?? "i"}/status/${t.id}`,
        publishedAt: t.created_at,
        metrics,
      };
    });
  },

  async getContentAnalytics(_token, _account, items) {
    return items;
  },

  async disconnect(token: TokenSet) {
    try {
      await fetch("https://api.twitter.com/2/oauth2/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth()}`,
        },
        body: form({ token: token.accessToken, token_type_hint: "access_token" }),
      });
    } catch {
      // Best effort.
    }
  },
};
