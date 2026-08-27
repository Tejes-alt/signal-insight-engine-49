/**
 * The intelligence engine.
 *
 * Takes normalized records out of the database and derives every number the
 * dashboard shows: volume, sentiment, topics, trends, engagement, anomalies,
 * account influence and cross-platform comparison. Every output carries the
 * evidence (record ids, windows, baselines) that produced it.
 */

import { analyzeSentiment, summarizeSentiment, type SentimentDistribution, type SentimentLabel } from "./sentiment";
import { bucketize, computeTrend, detectAnomalies, mean, type TrendMetrics } from "./series";
import { clusterTopics, rankKeywords } from "./text";

export interface EngineRecord {
  id: string;
  provider: string;
  providerAccountId: string | null;
  accountName: string | null;
  title: string | null;
  text: string | null;
  language: string | null;
  publishedAt: string;
  mediaType: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  hashtags: string[];
  likes: number | null;
  commentsCount: number | null;
  shares: number | null;
  views: number | null;
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  sentimentConfidence: number;
}

export interface EngineComment {
  id: string;
  postId: string;
  text: string | null;
  publishedAt: string;
  likes: number | null;
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  sentimentConfidence: number;
}

export interface Window {
  from: number;
  to: number;
  bucketMs: number;
  label: string;
}

export function resolveWindow(hours: number, now = Date.now()): Window {
  const to = now;
  const from = now - hours * 3_600_000;
  const bucketMs =
    hours <= 6 ? 15 * 60_000 : hours <= 24 ? 3_600_000 : hours <= 24 * 7 ? 6 * 3_600_000 : 24 * 3_600_000;
  const label =
    hours <= 24 ? `Last ${hours}h` : hours % 24 === 0 ? `Last ${hours / 24}d` : `Last ${hours}h`;
  return { from, to, bucketMs, label };
}

export function engagementOf(r: EngineRecord): number {
  return (r.likes ?? 0) + (r.commentsCount ?? 0) + (r.shares ?? 0);
}

/** Engagement relative to reach; null when the provider gave us no reach. */
export function engagementRate(r: EngineRecord): number | null {
  if (r.views === null || r.views === 0) return null;
  return (engagementOf(r) / r.views) * 100;
}

export interface SeriesPoint {
  t: number;
  label: string;
  volume: number;
  engagement: number;
  sentiment: number | null;
  positive: number;
  negative: number;
  neutral: number;
}

export function buildSeries(records: EngineRecord[], w: Window): SeriesPoint[] {
  const times = records.map((r) => new Date(r.publishedAt).getTime());
  const volume = bucketize(times, { from: w.from, to: w.to, bucketMs: w.bucketMs });
  const engagement = bucketize(times, {
    from: w.from,
    to: w.to,
    bucketMs: w.bucketMs,
    weights: records.map(engagementOf),
  });

  return volume.map((b, i) => {
    const inBucket = records.filter((r) => {
      const t = new Date(r.publishedAt).getTime();
      return t >= b.start && t < b.end;
    });
    const scored = inBucket.filter((r) => r.sentimentConfidence > 0.05);
    return {
      t: b.start,
      label: formatBucketLabel(b.start, w.bucketMs),
      volume: b.value,
      engagement: engagement[i]?.value ?? 0,
      sentiment: scored.length ? Number(mean(scored.map((r) => r.sentimentScore)).toFixed(3)) : null,
      positive: inBucket.filter((r) => r.sentimentLabel === "positive").length,
      negative: inBucket.filter((r) => r.sentimentLabel === "negative").length,
      neutral: inBucket.filter((r) => r.sentimentLabel === "neutral").length,
    };
  });
}

function formatBucketLabel(t: number, bucketMs: number): string {
  const d = new Date(t);
  if (bucketMs >= 24 * 3_600_000)
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (bucketMs >= 3_600_000)
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit" });
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export interface TopicIntelligence {
  label: string;
  keywords: string[];
  volume: number;
  share: number;
  engagement: number;
  sentiment: SentimentDistribution;
  trend: TrendMetrics;
  platforms: Record<string, number>;
  postIds: string[];
  topPostIds: string[];
  status: "exploding" | "emerging" | "rising" | "persistent" | "declining";
}

export function buildTopics(records: EngineRecord[], w: Window): TopicIntelligence[] {
  const docs = records
    .filter((r) => (r.text ?? "").trim().length > 0)
    .map((r) => ({ id: r.id, text: `${r.title ?? ""} ${r.text ?? ""}` }));
  if (docs.length < 3) return [];

  const byId = new Map(records.map((r) => [r.id, r]));
  const clusters = clusterTopics(docs, { maxTopics: 12, minPosts: 2 });

  return clusters
    .map<TopicIntelligence>((c) => {
      const members = c.postIds.map((id) => byId.get(id)!).filter(Boolean);
      const times = members.map((m) => new Date(m.publishedAt).getTime());
      const series = bucketize(times, { from: w.from, to: w.to, bucketMs: w.bucketMs }).map((b) => b.value);
      const trend = computeTrend(series, Math.max(2, Math.round(series.length * 0.3)));
      const platforms: Record<string, number> = {};
      for (const m of members) platforms[m.provider] = (platforms[m.provider] ?? 0) + 1;

      const firstHalf = series.slice(0, Math.floor(series.length / 2)).reduce((a, b) => a + b, 0);
      const status: TopicIntelligence["status"] =
        trend.growthPct !== null && trend.growthPct > 150
          ? "exploding"
          : firstHalf === 0
            ? "emerging"
            : trend.direction === "rising"
              ? "rising"
              : trend.direction === "falling"
                ? "declining"
                : "persistent";

      return {
        label: c.label,
        keywords: c.keywords,
        volume: members.length,
        share: Number(((members.length / records.length) * 100).toFixed(1)),
        engagement: members.reduce((a, m) => a + engagementOf(m), 0),
        sentiment: summarizeSentiment(members),
        trend,
        platforms,
        postIds: c.postIds,
        topPostIds: [...members].sort((a, b) => engagementOf(b) - engagementOf(a)).slice(0, 5).map((m) => m.id),
        status,
      };
    })
    .sort((a, b) => b.volume - a.volume || b.trend.momentum - a.trend.momentum);
}

export interface AnomalyFinding {
  fingerprint: string;
  kind: string;
  metric: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  baseline: number;
  current: number;
  deviation: number;
  detectedAt: string;
  headline: string;
  scope: Record<string, unknown>;
  evidence: { postIds: string[]; window: string; method: string };
}

export function detectAllAnomalies(
  records: EngineRecord[],
  series: SeriesPoint[],
  topics: TopicIntelligence[],
  w: Window,
): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];
  const windowLabel = `${new Date(w.from).toISOString()} → ${new Date(w.to).toISOString()}`;

  const idsInBucket = (t: number) =>
    records
      .filter((r) => {
        const ts = new Date(r.publishedAt).getTime();
        return ts >= t && ts < t + w.bucketMs;
      })
      .map((r) => r.id);

  for (const a of detectAnomalies(series.map((p) => p.volume), 3)) {
    const point = series[a.index]!;
    findings.push({
      fingerprint: `volume:${point.t}`,
      kind: a.kind === "spike" ? "conversation_spike" : "conversation_drop",
      metric: "conversation_volume",
      severity: a.severity,
      confidence: Math.min(0.95, 0.5 + Math.abs(a.deviation) / 20),
      baseline: a.baseline,
      current: a.value,
      deviation: a.deviation,
      detectedAt: new Date(point.t).toISOString(),
      headline:
        a.kind === "spike"
          ? `Conversation volume spiked to ${a.value} records vs a ${a.baseline} baseline`
          : `Conversation volume collapsed to ${a.value} records vs a ${a.baseline} baseline`,
      scope: { bucket: point.label },
      evidence: { postIds: idsInBucket(point.t), window: windowLabel, method: "median + MAD, |z| ≥ 3" },
    });
  }

  for (const a of detectAnomalies(series.map((p) => p.engagement), 3.2)) {
    const point = series[a.index]!;
    findings.push({
      fingerprint: `engagement:${point.t}`,
      kind: a.kind === "spike" ? "engagement_spike" : "engagement_collapse",
      metric: "engagement",
      severity: a.severity,
      confidence: Math.min(0.95, 0.45 + Math.abs(a.deviation) / 20),
      baseline: a.baseline,
      current: a.value,
      deviation: a.deviation,
      detectedAt: new Date(point.t).toISOString(),
      headline:
        a.kind === "spike"
          ? `Engagement spiked to ${Math.round(a.value).toLocaleString()} interactions in one interval`
          : `Engagement fell to ${Math.round(a.value).toLocaleString()} interactions in one interval`,
      scope: { bucket: point.label },
      evidence: { postIds: idsInBucket(point.t), window: windowLabel, method: "median + MAD, |z| ≥ 3.2" },
    });
  }

  const sentimentSeries = series.map((p) => p.sentiment).filter((v): v is number => v !== null);
  if (sentimentSeries.length >= 6) {
    const trend = computeTrend(sentimentSeries, 3);
    if (Math.abs(trend.deviation) >= 2.5) {
      findings.push({
        fingerprint: `sentiment-shift:${Math.round(w.to / w.bucketMs)}`,
        kind: "sentiment_shift",
        metric: "sentiment",
        severity: Math.abs(trend.deviation) >= 5 ? "high" : "medium",
        confidence: trend.confidence,
        baseline: trend.baseline,
        current: trend.current,
        deviation: trend.deviation,
        detectedAt: new Date(w.to).toISOString(),
        headline: `Average sentiment moved from ${trend.baseline.toFixed(2)} to ${trend.current.toFixed(2)}`,
        scope: { direction: trend.direction },
        evidence: {
          postIds: records.slice(0, 8).map((r) => r.id),
          window: windowLabel,
          method: "windowed mean shift vs MAD spread",
        },
      });
    }
  }

  for (const topic of topics.slice(0, 8)) {
    if (topic.status === "emerging" && topic.volume >= 3) {
      findings.push({
        fingerprint: `topic-emergence:${topic.label}`,
        kind: "topic_emergence",
        metric: "topic_volume",
        severity: topic.volume >= 6 ? "high" : "medium",
        confidence: topic.trend.confidence,
        baseline: 0,
        current: topic.volume,
        deviation: topic.trend.deviation,
        detectedAt: new Date(w.to).toISOString(),
        headline: `New narrative "${topic.label}" appeared with ${topic.volume} records and no prior baseline`,
        scope: { topic: topic.label, keywords: topic.keywords },
        evidence: { postIds: topic.postIds.slice(0, 10), window: windowLabel, method: "first-appearance clustering" },
      });
    } else if (topic.trend.growthPct !== null && topic.trend.growthPct > 200 && topic.volume >= 4) {
      findings.push({
        fingerprint: `topic-burst:${topic.label}`,
        kind: "keyword_burst",
        metric: "topic_volume",
        severity: topic.trend.growthPct > 400 ? "high" : "medium",
        confidence: topic.trend.confidence,
        baseline: topic.trend.baseline,
        current: topic.trend.current,
        deviation: topic.trend.deviation,
        detectedAt: new Date(w.to).toISOString(),
        headline: `"${topic.label}" grew ${Math.round(topic.trend.growthPct)}% against its own baseline`,
        scope: { topic: topic.label },
        evidence: { postIds: topic.topPostIds, window: windowLabel, method: "per-topic windowed growth" },
      });
    }
  }

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
  return findings.sort(
    (a, b) =>
      severityRank[b.severity] - severityRank[a.severity] ||
      Math.abs(b.deviation) - Math.abs(a.deviation),
  );
}

export interface AccountIntelligence {
  providerAccountId: string;
  name: string;
  provider: string;
  posts: number;
  engagement: number;
  avgEngagement: number;
  views: number | null;
  engagementRate: number | null;
  sentiment: SentimentDistribution;
  momentum: number;
  topTopics: string[];
  peakHour: number | null;
  health: {
    score: number;
    components: { label: string; value: number; explanation: string }[];
  };
}

export function buildAccountIntelligence(
  records: EngineRecord[],
  topics: TopicIntelligence[],
  w: Window,
): AccountIntelligence[] {
  const groups = new Map<string, EngineRecord[]>();
  for (const r of records) {
    if (!r.providerAccountId) continue;
    const list = groups.get(r.providerAccountId) ?? [];
    list.push(r);
    groups.set(r.providerAccountId, list);
  }
  const totalEngagement = records.reduce((a, r) => a + engagementOf(r), 0) || 1;

  return Array.from(groups.entries())
    .map(([id, list]) => {
      const engagement = list.reduce((a, r) => a + engagementOf(r), 0);
      const viewsKnown = list.filter((r) => r.views !== null);
      const views = viewsKnown.length ? viewsKnown.reduce((a, r) => a + (r.views ?? 0), 0) : null;
      const rate = views && views > 0 ? (engagement / views) * 100 : null;
      const sentiment = summarizeSentiment(list);
      const times = list.map((r) => new Date(r.publishedAt).getTime());
      const series = bucketize(times, { from: w.from, to: w.to, bucketMs: w.bucketMs }).map((b) => b.value);
      const trend = computeTrend(series, Math.max(2, Math.round(series.length * 0.3)));

      const hourCounts = new Map<number, number>();
      for (const r of list) {
        const h = new Date(r.publishedAt).getUTCHours();
        hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
      }
      const peakHour =
        hourCounts.size > 0
          ? Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0]![0]
          : null;

      const share = (engagement / totalEngagement) * 100;
      const components = [
        {
          label: "Conversation influence",
          value: Math.min(100, share * 2),
          explanation: `${share.toFixed(1)}% of all engagement in the window originated from this account.`,
        },
        {
          label: "Engagement quality",
          value: rate === null ? 50 : Math.min(100, rate * 12),
          explanation:
            rate === null
              ? "Reach is not exposed by this provider, so quality is scored neutrally."
              : `${rate.toFixed(2)}% of viewers interacted.`,
        },
        {
          label: "Audience sentiment",
          value: Math.round((sentiment.averageScore + 1) * 50),
          explanation: `Mean sentiment ${sentiment.averageScore.toFixed(2)} across ${sentiment.total} records.`,
        },
        {
          label: "Momentum",
          value: trend.momentum,
          explanation: `Publishing/attention trend is ${trend.direction} (velocity ${trend.velocity.toFixed(2)}/interval).`,
        },
      ];

      return {
        providerAccountId: id,
        name: list[0]?.accountName ?? "Unknown source",
        provider: list[0]?.provider ?? "unknown",
        posts: list.length,
        engagement,
        avgEngagement: Math.round(engagement / list.length),
        views,
        engagementRate: rate === null ? null : Number(rate.toFixed(3)),
        sentiment,
        momentum: trend.momentum,
        topTopics: topics
          .filter((t) => t.postIds.some((pid) => list.some((r) => r.id === pid)))
          .slice(0, 4)
          .map((t) => t.label),
        peakHour,
        health: {
          score: Math.round(mean(components.map((c) => c.value))),
          components: components.map((c) => ({ ...c, value: Math.round(c.value) })),
        },
      };
    })
    .sort((a, b) => b.engagement - a.engagement);
}

export interface PlatformComparison {
  provider: string;
  volume: number;
  engagement: number;
  avgEngagement: number;
  sentiment: SentimentDistribution;
  momentum: number;
  growthPct: number | null;
}

export function buildPlatformComparison(records: EngineRecord[], w: Window): PlatformComparison[] {
  const groups = new Map<string, EngineRecord[]>();
  for (const r of records) {
    const list = groups.get(r.provider) ?? [];
    list.push(r);
    groups.set(r.provider, list);
  }
  return Array.from(groups.entries()).map(([provider, list]) => {
    const series = bucketize(list.map((r) => new Date(r.publishedAt).getTime()), {
      from: w.from,
      to: w.to,
      bucketMs: w.bucketMs,
    }).map((b) => b.value);
    const trend = computeTrend(series, Math.max(2, Math.round(series.length * 0.3)));
    const engagement = list.reduce((a, r) => a + engagementOf(r), 0);
    return {
      provider,
      volume: list.length,
      engagement,
      avgEngagement: Math.round(engagement / list.length),
      sentiment: summarizeSentiment(list),
      momentum: trend.momentum,
      growthPct: trend.growthPct,
    };
  });
}

export interface IntelligenceSnapshot {
  window: { from: string; to: string; label: string; bucketMs: number };
  totals: {
    records: number;
    comments: number;
    engagement: number;
    views: number | null;
    accounts: number;
    providers: string[];
  };
  volumeTrend: TrendMetrics;
  engagementTrend: TrendMetrics;
  sentiment: SentimentDistribution;
  sentimentTrend: TrendMetrics;
  commentSentiment: SentimentDistribution;
  series: SeriesPoint[];
  topics: TopicIntelligence[];
  keywords: { term: string; count: number; score: number }[];
  hashtags: { tag: string; count: number }[];
  anomalies: AnomalyFinding[];
  accounts: AccountIntelligence[];
  platforms: PlatformComparison[];
  topPosts: EngineRecord[];
}

export function buildSnapshot(
  records: EngineRecord[],
  comments: EngineComment[],
  w: Window,
): IntelligenceSnapshot {
  const series = buildSeries(records, w);
  const topics = buildTopics(records, w);
  const volumeTrend = computeTrend(series.map((p) => p.volume), Math.max(2, Math.round(series.length * 0.3)));
  const engagementTrend = computeTrend(series.map((p) => p.engagement), Math.max(2, Math.round(series.length * 0.3)));
  const sentimentSeries = series.map((p) => p.sentiment ?? 0);
  const sentimentTrend = computeTrend(sentimentSeries, Math.max(2, Math.round(series.length * 0.3)));

  const hashtagCounts = new Map<string, number>();
  for (const r of records) for (const h of r.hashtags) hashtagCounts.set(h, (hashtagCounts.get(h) ?? 0) + 1);

  const viewsKnown = records.filter((r) => r.views !== null);

  return {
    window: {
      from: new Date(w.from).toISOString(),
      to: new Date(w.to).toISOString(),
      label: w.label,
      bucketMs: w.bucketMs,
    },
    totals: {
      records: records.length,
      comments: comments.length,
      engagement: records.reduce((a, r) => a + engagementOf(r), 0),
      views: viewsKnown.length ? viewsKnown.reduce((a, r) => a + (r.views ?? 0), 0) : null,
      accounts: new Set(records.map((r) => r.providerAccountId).filter(Boolean)).size,
      providers: Array.from(new Set(records.map((r) => r.provider))),
    },
    volumeTrend,
    engagementTrend,
    sentiment: summarizeSentiment(records),
    sentimentTrend,
    commentSentiment: summarizeSentiment(comments),
    series,
    topics,
    keywords: rankKeywords(
      records.map((r) => `${r.title ?? ""} ${r.text ?? ""}`),
      24,
    ).map((k) => ({ term: k.term, count: k.count, score: Number(k.score.toFixed(2)) })),
    hashtags: Array.from(hashtagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count })),
    anomalies: detectAllAnomalies(records, series, topics, w),
    accounts: buildAccountIntelligence(records, topics, w),
    platforms: buildPlatformComparison(records, w),
    topPosts: [...records].sort((a, b) => engagementOf(b) - engagementOf(a)).slice(0, 10),
  };
}

export { analyzeSentiment, summarizeSentiment };
