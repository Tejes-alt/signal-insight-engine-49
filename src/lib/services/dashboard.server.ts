/**
 * Live dashboard aggregator. Server-only.
 *
 * Reads what the sync pipeline has actually persisted and folds it into the
 * same `AnalyticsBundle` the demo generator produces. Anything the connected
 * platform's API does not return stays `unavailable` with the reason attached —
 * this layer never substitutes a zero for missing data.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  available,
  growthFromSeries,
  mergeSeries,
  sumMetrics,
  unavailable,
  type AnalyticsBundle,
  type ContentItem,
  type PlatformSummary,
  type SeriesPoint,
} from "../analytics/dashboard";
import { deriveInsights } from "../demo/generate";
import { PROVIDERS, type ProviderId } from "../providers/registry";

interface AccountRecord {
  id: string;
  provider: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | string | null;
  status: string;
  last_synced_at: string | null;
}

interface PostRecord {
  id: string;
  provider: string;
  provider_account_id: string;
  title: string | null;
  text: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  published_at: string;
  likes: number | null;
  comments_count: number | null;
  shares: number | null;
  views: number | null;
}

const dayOf = (iso: string) => iso.slice(0, 10);

function capabilityNote(provider: ProviderId, metric: string): string {
  const descriptor = PROVIDERS[provider];
  return `${descriptor?.name ?? provider} does not return ${metric} through the connection this account uses.`;
}

function buildPlatform(
  account: AccountRecord,
  posts: PostRecord[],
  rangeDays: number,
): PlatformSummary {
  const provider = account.provider as ProviderId;
  const descriptor = PROVIDERS[provider];

  const buckets = new Map<string, { views: number | null; engagement: number; posts: number }>();
  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    buckets.set(d.toISOString().slice(0, 10), { views: null, engagement: 0, posts: 0 });
  }

  let totalViews: number | null = null;
  let totalEngagement = 0;
  let sawEngagement = false;

  for (const post of posts) {
    const bucket = buckets.get(dayOf(post.published_at));
    const engagement = (post.likes ?? 0) + (post.comments_count ?? 0) + (post.shares ?? 0);
    if (post.likes !== null || post.comments_count !== null || post.shares !== null) {
      sawEngagement = true;
      totalEngagement += engagement;
    }
    if (post.views !== null) totalViews = (totalViews ?? 0) + post.views;
    if (!bucket) continue;
    bucket.posts += 1;
    bucket.engagement += engagement;
    if (post.views !== null) bucket.views = (bucket.views ?? 0) + post.views;
  }

  const series: SeriesPoint[] = Array.from(buckets.entries()).map(([date, b]) => ({
    date,
    followers: null,
    views: b.views,
    engagement: b.engagement,
    reach: null,
    posts: b.posts,
  }));

  const followers = account.followers === null ? null : Number(account.followers);
  const rate =
    totalViews && totalViews > 0 && sawEngagement
      ? available(Number(((totalEngagement / totalViews) * 100).toFixed(2)))
      : unavailable("Needs both view counts and interactions for this period.");

  return {
    provider,
    accountId: account.id,
    name: account.display_name ?? account.handle ?? descriptor?.name ?? provider,
    handle: account.handle,
    displayName: account.display_name,
    avatarUrl: account.avatar_url,
    connected: account.status !== "disconnected",
    lastSyncedAt: account.last_synced_at,
    followers: followers === null ? unavailable(capabilityNote(provider, "follower counts")) : available(followers),
    views: totalViews === null ? unavailable(capabilityNote(provider, "view counts")) : available(totalViews),
    engagement: sawEngagement ? available(totalEngagement) : unavailable(capabilityNote(provider, "engagement")),
    reach: unavailable(capabilityNote(provider, "reach")),
    impressions: unavailable(capabilityNote(provider, "impressions")),
    posts: available(posts.length),
    engagementRate: rate,
    growth: {
      d7: null,
      d30: null,
      d90: null,
      y1: null,
    },
    extras: [],
    series,
  };
}

export async function buildLiveBundle(orgId: string, rangeDays: number): Promise<AnalyticsBundle> {
  const since = new Date(Date.now() - rangeDays * 86400000).toISOString();

  const { data: accountRows, error: accountError } = await supabaseAdmin
    .from("provider_accounts")
    .select("id, provider, handle, display_name, avatar_url, followers, status, last_synced_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (accountError) throw new Error(accountError.message);

  const accounts = (accountRows ?? []) as AccountRecord[];

  const { data: postRows, error: postError } = await supabaseAdmin
    .from("posts")
    .select(
      "id, provider, provider_account_id, title, text, permalink, thumbnail_url, published_at, likes, comments_count, shares, views",
    )
    .eq("org_id", orgId)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(5000);
  if (postError) throw new Error(postError.message);

  const posts = (postRows ?? []) as PostRecord[];
  const byAccount = new Map<string, PostRecord[]>();
  for (const post of posts) {
    const list = byAccount.get(post.provider_account_id) ?? [];
    list.push(post);
    byAccount.set(post.provider_account_id, list);
  }

  const platforms = accounts.map((account) =>
    buildPlatform(account, byAccount.get(account.id) ?? [], rangeDays),
  );

  const content: ContentItem[] = posts.slice(0, 200).map((post) => {
    const engagement = (post.likes ?? 0) + (post.comments_count ?? 0) + (post.shares ?? 0);
    const provider = post.provider as ProviderId;
    return {
      id: post.id,
      provider,
      title: post.title ?? post.text?.slice(0, 90) ?? "Untitled",
      thumbnailUrl: post.thumbnail_url,
      permalink: post.permalink,
      publishedAt: post.published_at,
      views: post.views === null ? unavailable(capabilityNote(provider, "view counts")) : available(post.views),
      likes: post.likes === null ? unavailable(capabilityNote(provider, "like counts")) : available(post.likes),
      comments:
        post.comments_count === null
          ? unavailable(capabilityNote(provider, "comment counts"))
          : available(post.comments_count),
      shares: post.shares === null ? unavailable(capabilityNote(provider, "share counts")) : available(post.shares),
      engagementRate:
        post.views && post.views > 0
          ? available(Number(((engagement / post.views) * 100).toFixed(2)))
          : unavailable("Needs a view count to calculate."),
    };
  });

  const series = mergeSeries(platforms.map((p) => p.series));
  const views = sumMetrics(platforms.map((p) => p.views), "No connected platform reports views.");
  const engagement = sumMetrics(platforms.map((p) => p.engagement), "No engagement data collected yet.");
  const rate =
    views.value && views.value > 0 && engagement.value !== null
      ? available(Number(((engagement.value / views.value) * 100).toFixed(2)))
      : unavailable("Engagement rate needs both views and interactions.");

  return {
    demo: false,
    generatedAt: new Date().toISOString(),
    rangeDays,
    platforms,
    totals: {
      reach: unavailable("Reach requires an authorized connection on a platform that reports it."),
      followers: sumMetrics(platforms.map((p) => p.followers), "No follower data collected yet."),
      engagement,
      engagementRate: rate,
      views,
      published: available(posts.length),
      growth: growthFromSeries(series, "followers"),
    },
    series,
    content: content.sort((a, b) => (b.views.value ?? 0) - (a.views.value ?? 0)),
    insights: deriveInsights(platforms, content),
  };
}
