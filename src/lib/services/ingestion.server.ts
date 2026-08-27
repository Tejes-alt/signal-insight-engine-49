/**
 * Ingestion pipeline. Server-only.
 *
 * provider adapter -> normalization -> deduplication -> persistence ->
 * sentiment scoring -> metric snapshots -> sync state.
 *
 * Ingestion is idempotent: records are upserted on (org, provider,
 * provider_post_id), so re-running a sync never duplicates and always refreshes
 * mutable metrics.
 */

import type { JsonObject } from "../json";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { analyzeSentiment, SENTIMENT_METHOD } from "../analytics/sentiment";
import type { NormalizedComment, NormalizedPost } from "../providers/normalized";
import { ProviderError, fetchUploads, resolveChannel } from "../providers/youtube.server";
import type { ProviderId } from "../providers/registry";

export interface SyncOutcome {
  accountId: string;
  newPosts: number;
  updatedPosts: number;
  newComments: number;
  cursor: string | null;
  note?: string | undefined;
}

interface AccountRow {
  id: string;
  org_id: string;
  provider: string;
  mode: string;
  external_id: string;
  handle: string | null;
  display_name: string | null;
  sync_cursor: string | null;
  metadata: JsonObject;
  paused: boolean;
}

/** Resolve a public source identifier through the provider's official API. */
export async function resolvePublicSource(provider: ProviderId, input: string) {
  if (provider === "youtube") return resolveChannel(input);
  throw new ProviderError(
    "not_implemented",
    `Public sources are not available for this provider yet. It requires an authorized account connection.`,
  );
}

async function fetchForAccount(account: AccountRow, full: boolean) {
  if (account.provider !== "youtube") {
    throw new ProviderError(
      "not_implemented",
      `No runtime adapter is enabled for ${account.provider} yet.`,
    );
  }
  const uploadsPlaylistId = account.metadata?.["uploadsPlaylistId"] as string | undefined;
  if (!uploadsPlaylistId) {
    throw new ProviderError("invalid_state", "This source is missing its uploads playlist reference. Reconnect it.");
  }
  return fetchUploads({
    uploadsPlaylistId,
    handle: account.handle,
    since: full ? null : account.sync_cursor,
    maxItems: full ? 100 : 50,
    includeComments: true,
    commentsPerPost: 25,
  });
}

function nextSyncAt(recordsFound: number): string {
  // Adaptive polling: an active source is checked often, a quiet one backs off.
  const minutes = recordsFound > 5 ? 15 : recordsFound > 0 ? 45 : 120;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function syncAccount(
  orgId: string,
  accountId: string,
  options: { full?: boolean } = {},
): Promise<SyncOutcome> {
  const { data: account, error } = await supabaseAdmin
    .from("provider_accounts")
    .select("id, org_id, provider, mode, external_id, handle, display_name, sync_cursor, metadata, paused")
    .eq("id", accountId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!account) throw new Error("Source not found in this workspace.");

  const row = account as AccountRow;

  const { data: job } = await supabaseAdmin
    .from("sync_jobs")
    .insert({ org_id: orgId, provider_account_id: accountId, kind: options.full ? "backfill" : "incremental", status: "running" })
    .select("id")
    .single();

  await supabaseAdmin
    .from("provider_accounts")
    .update({ sync_status: "syncing", updated_at: new Date().toISOString() })
    .eq("id", accountId);

  try {
    const result = await fetchForAccount(row, Boolean(options.full));
    const persisted = await persistRecords(orgId, accountId, row.provider, result.posts, result.comments);

    await supabaseAdmin
      .from("provider_accounts")
      .update({
        sync_status: "idle",
        status: "connected",
        last_synced_at: new Date().toISOString(),
        next_sync_at: nextSyncAt(persisted.newPosts),
        sync_cursor: result.cursor ?? row.sync_cursor,
        last_error: null,
        records_collected: await countRecords(orgId, accountId),
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    if (job) {
      await supabaseAdmin
        .from("sync_jobs")
        .update({ status: "completed", records: persisted.newPosts + persisted.updatedPosts, finished_at: new Date().toISOString() })
        .eq("id", job.id);
    }

    return { accountId, ...persisted, cursor: result.cursor, note: result.quotaNote };
  } catch (err) {
    const providerError = err instanceof ProviderError ? err : null;
    const message = err instanceof Error ? err.message : "Unknown synchronization failure.";
    const status =
      providerError?.code === "rate_limited"
        ? "rate_limited"
        : providerError?.code === "provider_not_configured"
          ? "setup_required"
          : "error";

    
    const { data: current } = await supabaseAdmin
      .from("provider_accounts")
      .select("error_count")
      .eq("id", accountId)
      .maybeSingle();

    await supabaseAdmin
      .from("provider_accounts")
      .update({
        sync_status: "idle",
        status,
        last_error: message,
        error_count: (current?.error_count ?? 0) + 1,
        next_sync_at: new Date(Date.now() + 30 * 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    if (job) {
      await supabaseAdmin
        .from("sync_jobs")
        .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
        .eq("id", job.id);
    }
    throw err;
  }
}

async function countRecords(orgId: string, accountId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("provider_account_id", accountId);
  return count ?? 0;
}

export async function persistRecords(
  orgId: string,
  accountId: string,
  provider: string,
  posts: NormalizedPost[],
  comments: NormalizedComment[],
): Promise<{ newPosts: number; updatedPosts: number; newComments: number }> {
  if (posts.length === 0 && comments.length === 0) {
    return { newPosts: 0, updatedPosts: 0, newComments: 0 };
  }

  const { data: existing } = await supabaseAdmin
    .from("posts")
    .select("id, provider_post_id")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .in("provider_post_id", posts.map((p) => p.providerPostId));
  const existingIds = new Set((existing ?? []).map((r) => r.provider_post_id));

  const rows = posts.map((p) => ({
    org_id: orgId,
    provider_account_id: accountId,
    provider: p.provider,
    provider_post_id: p.providerPostId,
    author_id: p.authorId,
    author_name: p.authorName,
    author_handle: p.authorHandle,
    title: p.title,
    text: p.text,
    language: p.language,
    location: p.location,
    published_at: p.publishedAt,
    media_type: p.mediaType,
    permalink: p.permalink,
    thumbnail_url: p.thumbnailUrl,
    hashtags: p.hashtags,
    mentions: p.mentions,
    likes: p.likes,
    comments_count: p.commentsCount,
    shares: p.shares,
    views: p.views,
    replies: p.replies,
    metric_provenance: p.metricProvenance,
    raw: (p.raw ?? null) as JsonObject | null,
    updated_at: new Date().toISOString(),
  }));

  let stored: { id: string; provider_post_id: string; likes: number | null; comments_count: number | null; shares: number | null; views: number | null }[] = [];
  if (rows.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("posts")
      .upsert(rows, { onConflict: "org_id,provider,provider_post_id" })
      .select("id, provider_post_id, likes, comments_count, shares, views");
    if (error) throw new Error(`Failed to store records: ${error.message}`);
    stored = data ?? [];
  }

  const idByProviderId = new Map(stored.map((r) => [r.provider_post_id, r.id]));

  // Metric snapshots power engagement velocity over time.
  if (stored.length > 0) {
    await supabaseAdmin.from("post_metric_snapshots").insert(
      stored.map((r) => ({
        org_id: orgId,
        post_id: r.id,
        likes: r.likes,
        comments_count: r.comments_count,
        shares: r.shares,
        views: r.views,
      })),
    );
  }

  // Sentiment for each post (deterministic, recomputed on content change).
  const sentimentRows = posts
    .map((p) => {
      const id = idByProviderId.get(p.providerPostId);
      if (!id) return null;
      const s = analyzeSentiment(`${p.title ?? ""}. ${p.text ?? ""}`);
      return {
        org_id: orgId,
        subject_type: "post",
        subject_id: id,
        label: s.label,
        score: s.score,
        confidence: s.confidence,
        method: SENTIMENT_METHOD,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (sentimentRows.length > 0) {
    await supabaseAdmin
      .from("sentiment_results")
      .upsert(sentimentRows, { onConflict: "subject_type,subject_id,method" });
  }

  let newComments = 0;
  if (comments.length > 0) {
    const commentRows = comments
      .map((c) => {
        const postId = idByProviderId.get(c.providerPostId);
        if (!postId) return null;
        return {
          org_id: orgId,
          post_id: postId,
          provider: c.provider,
          provider_comment_id: c.providerCommentId,
          author_name: c.authorName,
          author_handle: c.authorHandle,
          text: c.text,
          likes: c.likes,
          published_at: c.publishedAt,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (commentRows.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("post_comments")
        .upsert(commentRows, { onConflict: "org_id,provider,provider_comment_id" })
        .select("id, text");
      if (!error && data) {
        newComments = data.length;
        const commentSentiment = data.map((row) => {
          const s = analyzeSentiment(row.text ?? "");
          return {
            org_id: orgId,
            subject_type: "comment",
            subject_id: row.id,
            label: s.label,
            score: s.score,
            confidence: s.confidence,
            method: SENTIMENT_METHOD,
          };
        });
        await supabaseAdmin
          .from("sentiment_results")
          .upsert(commentSentiment, { onConflict: "subject_type,subject_id,method" });
      }
    }
  }

  const newPosts = posts.filter((p) => !existingIds.has(p.providerPostId)).length;
  return { newPosts, updatedPosts: posts.length - newPosts, newComments };
}
