/**
 * Intelligence materialization. Server-only.
 *
 * Loads normalized records for a workspace + filter set, runs the analytics
 * engine, and persists the derived artifacts (topics, trend snapshots, anomaly
 * events) so history, alerts and reports have something durable to reference.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildSnapshot,
  resolveWindow,
  type EngineComment,
  type EngineRecord,
  type IntelligenceSnapshot,
} from "../analytics/engine";
import type { SentimentLabel } from "../analytics/sentiment";

export interface IntelligenceFilters {
  hours: number;
  /* eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents */
  providers?: string[];
  accountIds?: string[];
  sentiment?: SentimentLabel[];
  language?: string | null;
  topic?: string | null;
  search?: string | null;
}

const MAX_RECORDS = 5000;

export async function loadRecords(
  orgId: string,
  filters: IntelligenceFilters,
): Promise<{ records: EngineRecord[]; comments: EngineComment[] }> {
  const from = new Date(Date.now() - filters.hours * 3_600_000).toISOString();

  let query = supabaseAdmin
    .from("posts")
    .select(
      "id, provider, provider_account_id, author_name, title, text, language, published_at, media_type, permalink, thumbnail_url, hashtags, likes, comments_count, shares, views, provider_accounts(display_name)",
    )
    .eq("org_id", orgId)
    .gte("published_at", from)
    .order("published_at", { ascending: false })
    .limit(MAX_RECORDS);

  if (filters.providers?.length) query = query.in("provider", filters.providers);
  if (filters.accountIds?.length) query = query.in("provider_account_id", filters.accountIds);
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,text.ilike.%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const postIds = rows.map((r) => r.id);
  const sentimentByPost = await loadSentiment(orgId, "post", postIds);

  let records: EngineRecord[] = rows.map((r) => {
    const s = sentimentByPost.get(r.id);
    const account = r.provider_accounts as unknown as { display_name: string | null } | null;
    return {
      id: r.id,
      provider: r.provider,
      providerAccountId: r.provider_account_id,
      accountName: account?.display_name ?? r.author_name ?? null,
      title: r.title,
      text: r.text,
      language: r.language,
      publishedAt: r.published_at,
      mediaType: r.media_type,
      permalink: r.permalink,
      thumbnailUrl: r.thumbnail_url,
      hashtags: r.hashtags ?? [],
      likes: r.likes === null ? null : Number(r.likes),
      commentsCount: r.comments_count === null ? null : Number(r.comments_count),
      shares: r.shares === null ? null : Number(r.shares),
      views: r.views === null ? null : Number(r.views),
      sentimentScore: s?.score ?? 0,
      sentimentLabel: s?.label ?? "neutral",
      sentimentConfidence: s?.confidence ?? 0,
    };
  });

  if (filters.sentiment?.length) {
    records = records.filter((r) => filters.sentiment!.includes(r.sentimentLabel));
  }
  if (filters.topic) {
    const needle = filters.topic.toLowerCase();
    records = records.filter((r) => `${r.title ?? ""} ${r.text ?? ""}`.toLowerCase().includes(needle));
  }

  const comments = await loadComments(orgId, records.map((r) => r.id), from);
  return { records, comments };
}

async function loadSentiment(orgId: string, subjectType: string, ids: string[]) {
  const map = new Map<string, { score: number; label: SentimentLabel; confidence: number }>();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    if (chunk.length === 0) continue;
    const { data } = await supabaseAdmin
      .from("sentiment_results")
      .select("subject_id, score, label, confidence")
      .eq("org_id", orgId)
      .eq("subject_type", subjectType)
      .in("subject_id", chunk);
    for (const row of data ?? []) {
      map.set(row.subject_id, {
        score: row.score,
        label: row.label as SentimentLabel,
        confidence: row.confidence,
      });
    }
  }
  return map;
}

async function loadComments(orgId: string, postIds: string[], from: string): Promise<EngineComment[]> {
  if (postIds.length === 0) return [];
  const out: EngineComment[] = [];
  for (let i = 0; i < postIds.length; i += 200) {
    const chunk = postIds.slice(i, i + 200);
    const { data } = await supabaseAdmin
      .from("post_comments")
      .select("id, post_id, text, published_at, likes")
      .eq("org_id", orgId)
      .in("post_id", chunk)
      .gte("published_at", from)
      .limit(4000);
    for (const row of data ?? []) {
      out.push({
        id: row.id,
        postId: row.post_id,
        text: row.text,
        publishedAt: row.published_at,
        likes: row.likes === null ? null : Number(row.likes),
        sentimentScore: 0,
        sentimentLabel: "neutral",
        sentimentConfidence: 0,
      });
    }
  }
  const sentiment = await loadSentiment(orgId, "comment", out.map((c) => c.id));
  return out.map((c) => {
    const s = sentiment.get(c.id);
    return s ? { ...c, sentimentScore: s.score, sentimentLabel: s.label, sentimentConfidence: s.confidence } : c;
  });
}

export async function computeSnapshot(
  orgId: string,
  filters: IntelligenceFilters,
): Promise<IntelligenceSnapshot> {
  const { records, comments } = await loadRecords(orgId, filters);
  const window = resolveWindow(filters.hours);
  return buildSnapshot(records, comments, window);
}

/**
 * Persists derived intelligence so anomalies, topics and trends survive across
 * sessions and can drive alerts. Fingerprints make this idempotent.
 */
export async function materialize(orgId: string, snapshot: IntelligenceSnapshot): Promise<void> {
  for (const topic of snapshot.topics.slice(0, 12)) {
    const { data: topicRow } = await supabaseAdmin
      .from("topics")
      .upsert(
        {
          org_id: orgId,
          label: topic.label,
          keywords: topic.keywords,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "org_id,label" },
      )
      .select("id")
      .single();
    if (!topicRow) continue;

    await supabaseAdmin.from("topic_assignments").upsert(
      topic.postIds.map((postId) => ({ org_id: orgId, topic_id: topicRow.id, post_id: postId, weight: 1 })),
      { onConflict: "topic_id,post_id" },
    );

    await supabaseAdmin.from("trend_snapshots").insert({
      org_id: orgId,
      topic_id: topicRow.id,
      window_start: snapshot.window.from,
      window_end: snapshot.window.to,
      volume: topic.volume,
      baseline: topic.trend.baseline,
      velocity: topic.trend.velocity,
      acceleration: topic.trend.acceleration,
      momentum: topic.trend.momentum,
      sentiment_avg: topic.sentiment.averageScore,
      engagement: topic.engagement,
      platform_breakdown: topic.platforms,
    });
  }

  if (snapshot.anomalies.length > 0) {
    await supabaseAdmin.from("anomaly_events").upsert(
      snapshot.anomalies.map((a) => ({
        org_id: orgId,
        kind: a.kind,
        metric: a.metric,
        severity: a.severity,
        confidence: a.confidence,
        baseline: a.baseline,
        current_value: a.current,
        deviation: a.deviation,
        scope: { ...a.scope, headline: a.headline },
        evidence: a.evidence,
        detected_at: a.detectedAt,
        fingerprint: a.fingerprint,
      })),
      { onConflict: "org_id,fingerprint" },
    );
  }
}
