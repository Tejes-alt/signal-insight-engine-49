/**
 * Social Data Aggregator.
 *
 * Adds a tracked handle, retrieves whatever the platform publishes openly,
 * stores a real snapshot each time, and assembles analytics from those stored
 * snapshots. No credentials of any kind are involved.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccountStatus,
  ContentRow,
  PlatformId,
  PublicAccountView,
  PublicMetrics,
  SnapshotPoint,
} from "./types";
import {
  getPublicContent,
  getPublicContentMetrics,
  getProvider,
  normalizeHandle,
  resolveProfile,
} from "./registry.server";
import { engagementRate, postingFrequency, summarizeGrowth } from "./analytics";

interface AccountRow {
  id: string;
  org_id: string;
  platform: string;
  handle: string;
  profile_url: string | null;
  external_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: string;
  status_reason: string | null;
  first_tracked_at: string;
  last_checked_at: string | null;
}

type DB = SupabaseClient<any, any, any>;

export interface RefreshOutcome {
  platform: PlatformId;
  handle: string;
  status: AccountStatus;
  message: string | null;
}

/** Retrieves public data for one tracked account and stores a new snapshot. */
export async function refreshAccount(db: DB, account: AccountRow): Promise<RefreshOutcome> {
  const platform = account.platform as PlatformId;
  let status: AccountStatus = "unavailable";
  let message: string | null = null;

  try {
    const resolved = await resolveProfile(platform, account.handle);
    const content = await getPublicContent(platform, resolved);
    const contentMetrics = getPublicContentMetrics(content);
    const metrics: PublicMetrics = {
      ...resolved.metrics,
      views: resolved.metrics.views ?? contentMetrics.totalViews,
      likes: resolved.metrics.likes ?? contentMetrics.totalLikes,
      comments: resolved.metrics.comments ?? contentMetrics.totalComments,
    };

    const retrievedAny = Object.values(metrics).some((v) => typeof v === "number");
    status = retrievedAny || content.length > 0 ? "partial" : "unavailable";
    if (!retrievedAny && content.length === 0) {
      message = "This platform isn't sharing public information right now.";
    }

    await db
      .from("public_accounts")
      .update({
        profile_url: resolved.profile.profileUrl,
        external_id: resolved.profile.externalId ?? null,
        display_name: resolved.profile.displayName ?? null,
        avatar_url: resolved.profile.avatarUrl ?? null,
        bio: resolved.profile.bio ?? null,
        status,
        status_reason: message,
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    if (retrievedAny) {
      await db.from("account_snapshots").insert({
        account_id: account.id,
        org_id: account.org_id,
        followers: metrics.followers ?? null,
        following: metrics.following ?? null,
        posts: metrics.posts ?? null,
        views: metrics.views ?? null,
        likes: metrics.likes ?? null,
        comments: metrics.comments ?? null,
      });
    }

    if (content.length) {
      await db.from("public_content").upsert(
        content.map((item) => ({
          account_id: account.id,
          org_id: account.org_id,
          external_id: item.externalId,
          title: item.title ?? null,
          url: item.url ?? null,
          thumbnail_url: item.thumbnailUrl ?? null,
          published_at: item.publishedAt ?? null,
          views: item.views ?? null,
          likes: item.likes ?? null,
          comments: item.comments ?? null,
          fetched_at: new Date().toISOString(),
        })),
        { onConflict: "account_id,external_id" },
      );
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    status = name === "ProfileNotFoundError" ? "not_found" : "unavailable";
    message =
      status === "not_found"
        ? "Couldn't find this account."
        : "Public data isn't currently available for this platform.";
    await db
      .from("public_accounts")
      .update({ status, status_reason: message, last_checked_at: new Date().toISOString() })
      .eq("id", account.id);
  }

  return { platform, handle: account.handle, status, message };
}

/** Starts tracking a handle: stores it, then immediately retrieves public data. */
export async function addAccount(
  db: DB,
  orgId: string,
  platform: PlatformId,
  rawHandle: string,
): Promise<RefreshOutcome> {
  const handle = normalizeHandle(platform, rawHandle);
  if (!handle) throw new Error("Please enter a username.");
  const provider = getProvider(platform);

  const { data, error } = await db
    .from("public_accounts")
    .upsert(
      {
        org_id: orgId,
        platform,
        handle,
        profile_url: provider.profileUrl(handle),
        status: "pending",
        status_reason: null,
      },
      { onConflict: "org_id,platform,handle" },
    )
    .select("*")
    .single();
  if (error || !data) throw new Error("We couldn't save that account. Please try again.");

  return refreshAccount(db, data as AccountRow);
}

export async function removeAccount(db: DB, orgId: string, accountId: string): Promise<void> {
  await db.from("public_accounts").delete().eq("id", accountId).eq("org_id", orgId);
}

export async function refreshAll(db: DB, orgId: string): Promise<RefreshOutcome[]> {
  const { data } = await db.from("public_accounts").select("*").eq("org_id", orgId);
  const rows = (data ?? []) as AccountRow[];
  const outcomes: RefreshOutcome[] = [];
  for (const row of rows) outcomes.push(await refreshAccount(db, row));
  return outcomes;
}

/** Reads stored accounts, snapshots and content into the view model. */
export async function listAccounts(db: DB, orgId: string): Promise<PublicAccountView[]> {
  const [{ data: accounts }, { data: snapshots }, { data: content }] = await Promise.all([
    db.from("public_accounts").select("*").eq("org_id", orgId).order("created_at"),
    db
      .from("account_snapshots")
      .select("account_id,captured_at,followers,posts,views,likes,comments")
      .eq("org_id", orgId)
      .order("captured_at"),
    db
      .from("public_content")
      .select("account_id,external_id,title,url,thumbnail_url,published_at,views,likes,comments")
      .eq("org_id", orgId)
      .order("published_at", { ascending: false }),
  ]);

  const rows = (accounts ?? []) as AccountRow[];

  return rows.map((row) => {
    const platform = row.platform as PlatformId;
    const history: SnapshotPoint[] = (snapshots ?? [])
      .filter((s: any) => s.account_id === row.id)
      .map((s: any) => ({
        capturedAt: s.captured_at as string,
        followers: s.followers === null ? null : Number(s.followers),
        posts: s.posts === null ? null : Number(s.posts),
        views: s.views === null ? null : Number(s.views),
        likes: s.likes === null ? null : Number(s.likes),
        comments: s.comments === null ? null : Number(s.comments),
      }));

    const items: ContentRow[] = (content ?? [])
      .filter((c: any) => c.account_id === row.id)
      .slice(0, 30)
      .map((c: any) => ({
        platform,
        accountHandle: row.handle,
        externalId: c.external_id as string,
        title: c.title,
        url: c.url,
        thumbnailUrl: c.thumbnail_url,
        publishedAt: c.published_at,
        views: c.views === null ? null : Number(c.views),
        likes: c.likes === null ? null : Number(c.likes),
        comments: c.comments === null ? null : Number(c.comments),
      }));

    const latest = history.at(-1);
    const contentMetrics = getPublicContentMetrics(items);
    const metrics: PublicMetrics = {
      followers: latest?.followers ?? null,
      following: null,
      posts: latest?.posts ?? (items.length || null),
      views: latest?.views ?? contentMetrics.totalViews,
      likes: latest?.likes ?? contentMetrics.totalLikes,
      comments: latest?.comments ?? contentMetrics.totalComments,
    };

    const retrieved = (Object.keys(metrics) as (keyof PublicMetrics)[]).filter(
      (key) => typeof metrics[key] === "number",
    );

    const rate = engagementRate({
      followers: metrics.followers,
      avgLikes: contentMetrics.avgLikes,
      avgComments: contentMetrics.avgComments,
    });

    return {
      id: row.id,
      platform,
      handle: row.handle,
      profileUrl: row.profile_url,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      status: row.status as AccountStatus,
      statusMessage: row.status_reason,
      firstTrackedAt: row.first_tracked_at,
      lastCheckedAt: row.last_checked_at,
      metrics,
      retrieved: retrieved as PublicAccountView["retrieved"],
      engagementRate: rate,
      avgLikes: contentMetrics.avgLikes,
      avgComments: contentMetrics.avgComments,
      avgViews: contentMetrics.avgViews,
      postsPerWeek: postingFrequency(items),
      growth: summarizeGrowth(history, row.first_tracked_at),
      history,
      content: items,
    } satisfies PublicAccountView;
  });
}
