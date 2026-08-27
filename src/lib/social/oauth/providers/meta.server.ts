/**
 * Instagram + Facebook integrations — Meta Login and the Graph API.
 * Server-only. Both platforms share one authorization app, so they share this
 * module and differ only in which node they read.
 */

import type { JsonObject } from "@/lib/json";
import { integrationConfig } from "../config.server";
import { buildAuthUrl, expiryFromSeconds, requestJson } from "../http.server";
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

const GRAPH = "https://graph.facebook.com/v21.0";

const IG_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
];
const FB_SCOPES = ["pages_show_list", "pages_read_engagement", "read_insights", "business_management"];

function config(platform: "instagram" | "facebook") {
  const cfg = integrationConfig(platform);
  if (!cfg) throw new IntegrationNotConfiguredError(platform, ["META_APP_ID", "META_APP_SECRET"]);
  return cfg;
}

interface PageEntry {
  id: string;
  name: string;
  access_token: string;
  fan_count?: number;
  followers_count?: number;
  picture?: { data?: { url?: string } };
  instagram_business_account?: { id: string };
}

async function pages(token: TokenSet): Promise<PageEntry[]> {
  const data = await requestJson<{ data?: PageEntry[] }>(
    `${GRAPH}/me/accounts?fields=id,name,access_token,fan_count,followers_count,picture{url},instagram_business_account&access_token=${encodeURIComponent(token.accessToken)}`,
    { platformName: "Facebook" },
  );
  return data.data ?? [];
}

function pageToken(account: ProviderAccount, fallback: string): string {
  return (account.metadata as { pageToken?: string }).pageToken ?? fallback;
}

function makeProvider(platform: "instagram" | "facebook"): SocialProvider {
  const scopes = platform === "instagram" ? IG_SCOPES : FB_SCOPES;
  const label = platform === "instagram" ? "Instagram" : "Facebook";

  return {
    id: platform,
    requiredSecrets: ["META_APP_ID", "META_APP_SECRET"],
    capabilities:
      platform === "instagram"
        ? [
            "followers",
            "following",
            "reach",
            "impressions",
            "profileViews",
            "likes",
            "comments",
            "saves",
            "shares",
            "videoViews",
            "posts",
            "engagement",
            "engagementRate",
          ]
        : ["followers", "reach", "impressions", "likes", "comments", "shares", "videoViews", "posts", "engagement", "engagementRate"],

    async discoverAccount() {
      // Meta does not expose a lawful public lookup for personal accounts.
      return null;
    },

    async connect(req: AuthorizeRequest) {
      const cfg = config(platform);
      return {
        url: buildAuthUrl("https://www.facebook.com/v21.0/dialog/oauth", {
          client_id: cfg.clientId,
          redirect_uri: req.redirectUri,
          response_type: "code",
          scope: scopes.join(","),
          state: req.state,
        }),
      };
    },

    async callback(req: CallbackRequest) {
      const cfg = config(platform);
      const short = await requestJson<{ access_token: string; expires_in?: number }>(
        `${GRAPH}/oauth/access_token?client_id=${cfg.clientId}&client_secret=${cfg.clientSecret}&redirect_uri=${encodeURIComponent(req.redirectUri)}&code=${encodeURIComponent(req.code)}`,
        { platformName: label },
      );
      // Exchange for a long-lived credential so background updates keep working.
      const long = await requestJson<{ access_token: string; expires_in?: number }>(
        `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${cfg.clientId}&client_secret=${cfg.clientSecret}&fb_exchange_token=${encodeURIComponent(short.access_token)}`,
        { platformName: label },
      ).catch(() => short);
      return {
        accessToken: long.access_token,
        refreshToken: null,
        expiresAt: expiryFromSeconds(long.expires_in ?? 60 * 86400),
        scopes,
      };
    },

    async refresh(token: TokenSet) {
      const cfg = config(platform);
      const data = await requestJson<{ access_token: string; expires_in?: number }>(
        `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${cfg.clientId}&client_secret=${cfg.clientSecret}&fb_exchange_token=${encodeURIComponent(token.accessToken)}`,
        { platformName: label },
      );
      return {
        accessToken: data.access_token,
        refreshToken: null,
        expiresAt: expiryFromSeconds(data.expires_in ?? 60 * 86400),
        scopes: token.scopes,
      };
    },

    async getAccount(token: TokenSet): Promise<ProviderAccount> {
      const list = await pages(token);
      if (platform === "facebook") {
        const page = list[0];
        if (!page) throw new Error("No Facebook Page was shared with SocialPulse during authorization.");
        return {
          externalId: page.id,
          handle: page.name,
          displayName: page.name,
          avatarUrl: page.picture?.data?.url ?? null,
          profileUrl: `https://facebook.com/${page.id}`,
          metadata: { pageToken: page.access_token, fanCount: page.fan_count ?? null } as JsonObject,
        };
      }
      const withIg = list.find((p) => p.instagram_business_account?.id);
      if (!withIg?.instagram_business_account)
        throw new Error(
          "No Instagram Business or Creator account is linked to the Facebook Page you selected. Instagram only shares analytics for those account types.",
        );
      const igId = withIg.instagram_business_account.id;
      const profile = await requestJson<{
        id: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
        followers_count?: number;
        follows_count?: number;
        media_count?: number;
      }>(
        `${GRAPH}/${igId}?fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count&access_token=${encodeURIComponent(withIg.access_token)}`,
        { platformName: label },
      );
      return {
        externalId: profile.id,
        handle: profile.username ?? null,
        displayName: profile.name ?? profile.username ?? null,
        avatarUrl: profile.profile_picture_url ?? null,
        profileUrl: profile.username ? `https://instagram.com/${profile.username}` : null,
        metadata: {
          pageToken: withIg.access_token,
          followers: profile.followers_count ?? null,
          follows: profile.follows_count ?? null,
          mediaCount: profile.media_count ?? null,
        } as JsonObject,
      };
    },

    async getAnalytics(token: TokenSet, account: ProviderAccount): Promise<ProviderAnalytics> {
      const at = pageToken(account, token.accessToken);
      const metrics: StoredMetrics = {};
      const history: ProviderAnalytics["history"] = [];

      if (platform === "instagram") {
        const meta = account.metadata as { followers?: number | null; follows?: number | null; mediaCount?: number | null };
        if (meta.followers != null) metrics.followers = value(meta.followers);
        if (meta.follows != null) metrics.following = value(meta.follows);
        if (meta.mediaCount != null) metrics.posts = value(meta.mediaCount);
        try {
          const since = Math.floor((Date.now() - 29 * 86400000) / 1000);
          const until = Math.floor(Date.now() / 1000);
          const insights = await requestJson<{
            data?: { name: string; values?: { value: number; end_time?: string }[] }[];
          }>(
            `${GRAPH}/${account.externalId}/insights?metric=reach,impressions,profile_views&period=day&since=${since}&until=${until}&access_token=${encodeURIComponent(at)}`,
            { platformName: label },
          );
          const byDay = new Map<string, StoredMetrics>();
          const totals: Record<string, number> = {};
          for (const entry of insights.data ?? []) {
            const key =
              entry.name === "reach" ? "reach" : entry.name === "impressions" ? "impressions" : "profileViews";
            for (const point of entry.values ?? []) {
              totals[key] = (totals[key] ?? 0) + point.value;
              if (!point.end_time) continue;
              const date = point.end_time.slice(0, 10);
              const bucket = byDay.get(date) ?? {};
              (bucket as Record<string, unknown>)[key] = value(point.value);
              byDay.set(date, bucket);
            }
          }
          for (const [date, m] of byDay) history.push({ date, metrics: m });
          if (totals["reach"] != null) metrics.reach = value(totals["reach"]);
          if (totals["impressions"] != null) metrics.impressions = value(totals["impressions"]);
          if (totals["profileViews"] != null) metrics.profileViews = value(totals["profileViews"]);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Instagram insights are not available.";
          metrics.reach = absent("not_authorized", reason);
          metrics.impressions = absent("not_authorized", reason);
          metrics.profileViews = absent("not_authorized", reason);
        }
      } else {
        const meta = account.metadata as { fanCount?: number | null };
        if (meta.fanCount != null) metrics.followers = value(meta.fanCount);
        try {
          const insights = await requestJson<{
            data?: { name: string; values?: { value: number; end_time?: string }[] }[];
          }>(
            `${GRAPH}/${account.externalId}/insights?metric=page_impressions,page_post_engagements,page_video_views&period=day&access_token=${encodeURIComponent(at)}`,
            { platformName: label },
          );
          const byDay = new Map<string, StoredMetrics>();
          const totals: Record<string, number> = {};
          for (const entry of insights.data ?? []) {
            const key =
              entry.name === "page_impressions"
                ? "impressions"
                : entry.name === "page_video_views"
                  ? "videoViews"
                  : "engagement";
            for (const point of entry.values ?? []) {
              totals[key] = (totals[key] ?? 0) + point.value;
              if (!point.end_time) continue;
              const date = point.end_time.slice(0, 10);
              const bucket = byDay.get(date) ?? {};
              (bucket as Record<string, unknown>)[key] = value(point.value);
              byDay.set(date, bucket);
            }
          }
          for (const [date, m] of byDay) history.push({ date, metrics: m });
          for (const [k, v] of Object.entries(totals)) (metrics as Record<string, unknown>)[k] = value(v);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Page insights are not available.";
          metrics.impressions = absent("not_authorized", reason);
          metrics.engagement = absent("not_authorized", reason);
        }
        metrics.reach = metrics.reach ?? absent("unavailable", "Page reach requires the read_insights permission.");
      }

      return { metrics, history };
    },

    async getContent(token: TokenSet, account: ProviderAccount): Promise<ProviderContentItem[]> {
      const at = pageToken(account, token.accessToken);
      if (platform === "instagram") {
        const media = await requestJson<{
          data?: {
            id: string;
            caption?: string;
            media_type?: string;
            media_url?: string;
            thumbnail_url?: string;
            permalink?: string;
            timestamp: string;
            like_count?: number;
            comments_count?: number;
          }[];
        }>(
          `${GRAPH}/${account.externalId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=50&access_token=${encodeURIComponent(at)}`,
          { platformName: label },
        );
        return (media.data ?? []).map((m) => {
          const likes = m.like_count ?? null;
          const comments = m.comments_count ?? null;
          const metrics: StoredMetrics = {
            likes: likes === null ? absent("unavailable", "Hidden by the account.") : value(likes),
            comments: comments === null ? absent("unavailable", "Comments are hidden.") : value(comments),
            engagement: value((likes ?? 0) + (comments ?? 0)),
          };
          return {
            externalId: m.id,
            title: m.caption?.slice(0, 90) ?? null,
            caption: m.caption ?? null,
            mediaType: m.media_type?.toLowerCase() ?? null,
            thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
            permalink: m.permalink ?? null,
            publishedAt: m.timestamp,
            metrics,
          };
        });
      }
      const posts = await requestJson<{
        data?: {
          id: string;
          message?: string;
          created_time: string;
          permalink_url?: string;
          full_picture?: string;
          likes?: { summary?: { total_count?: number } };
          comments?: { summary?: { total_count?: number } };
          shares?: { count?: number };
        }[];
      }>(
        `${GRAPH}/${account.externalId}/posts?fields=id,message,created_time,permalink_url,full_picture,likes.summary(true),comments.summary(true),shares&limit=50&access_token=${encodeURIComponent(at)}`,
        { platformName: label },
      );
      return (posts.data ?? []).map((p) => {
        const likes = p.likes?.summary?.total_count ?? null;
        const comments = p.comments?.summary?.total_count ?? null;
        const shares = p.shares?.count ?? null;
        return {
          externalId: p.id,
          title: p.message?.slice(0, 90) ?? null,
          caption: p.message ?? null,
          mediaType: "post",
          thumbnailUrl: p.full_picture ?? null,
          permalink: p.permalink_url ?? null,
          publishedAt: p.created_time,
          metrics: {
            likes: likes === null ? absent("unavailable", "Not returned by the Page.") : value(likes),
            comments: comments === null ? absent("unavailable", "Not returned by the Page.") : value(comments),
            shares: shares === null ? absent("unavailable", "Not returned by the Page.") : value(shares),
            engagement: value((likes ?? 0) + (comments ?? 0) + (shares ?? 0)),
          },
        };
      });
    },

    async getContentAnalytics(token: TokenSet, account: ProviderAccount, items: ProviderContentItem[]) {
      if (platform !== "instagram" || items.length === 0) return items;
      const at = pageToken(account, token.accessToken);
      // Per-media insights are requested for the most recent items only, to stay
      // well inside Meta's rate limits.
      const slice = items.slice(0, 25);
      await Promise.all(
        slice.map(async (item) => {
          try {
            const data = await requestJson<{ data?: { name: string; values?: { value: number }[] }[] }>(
              `${GRAPH}/${item.externalId}/insights?metric=reach,impressions,saved,shares&access_token=${encodeURIComponent(at)}`,
              { platformName: label },
            );
            for (const entry of data.data ?? []) {
              const v = entry.values?.[0]?.value;
              if (v === undefined) continue;
              if (entry.name === "reach") item.metrics.reach = value(v);
              if (entry.name === "impressions") item.metrics.impressions = value(v);
              if (entry.name === "saved") item.metrics.saves = value(v);
              if (entry.name === "shares") item.metrics.shares = value(v);
            }
            const reach = item.metrics.reach?.value;
            const engagement = item.metrics.engagement?.value ?? 0;
            if (reach && reach > 0) {
              item.metrics.engagementRate = value(Number(((engagement / reach) * 100).toFixed(2)));
            }
          } catch {
            item.metrics.reach = absent("not_authorized", "Insights are only available for Business accounts.");
          }
        }),
      );
      return items;
    },

    async disconnect(token: TokenSet) {
      // Meta permission revocation requires the user node; best effort only.
      try {
        await fetch(`${GRAPH}/me/permissions?access_token=${encodeURIComponent(token.accessToken)}`, {
          method: "DELETE",
        });
      } catch {
        // The stored credential is deleted regardless.
      }
    },
  };
}

export const instagramProvider = makeProvider("instagram");
export const facebookProvider = makeProvider("facebook");
