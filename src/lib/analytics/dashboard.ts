/**
 * The unified dashboard model.
 *
 * Both the live database aggregator (`services/dashboard.server.ts`) and the
 * demo generator (`demo/generate.ts`) produce this exact shape, so the UI never
 * branches on data origin — it only reads `bundle.demo` to label the surface.
 *
 * Every metric is a `Metric`, never a bare number. A platform that does not
 * expose a figure through its official API returns `state: "unavailable"` with
 * the reason, and the UI renders that reason instead of a zero.
 */

import type { ProviderId } from "../providers/registry";

export type MetricState = "available" | "unavailable";

export interface Metric {
  value: number | null;
  state: MetricState;
  /** Why the value is missing. Rendered verbatim in tooltips. */
  note?: string | undefined;
}

export const available = (value: number): Metric => ({ value, state: "available" });
export const unavailable = (note: string): Metric => ({ value: null, state: "unavailable", note });

export interface SeriesPoint {
  date: string;
  followers: number | null;
  views: number | null;
  engagement: number | null;
  reach: number | null;
  posts: number | null;
}

export interface GrowthWindow {
  d7: number | null;
  d30: number | null;
  d90: number | null;
  y1: number | null;
}

export interface PlatformExtra {
  label: string;
  metric: Metric;
  format?: "number" | "percent" | "duration" | undefined;
}

export interface PlatformSummary {
  provider: ProviderId;
  accountId: string;
  name: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  connected: boolean;
  lastSyncedAt: string | null;
  followers: Metric;
  views: Metric;
  engagement: Metric;
  reach: Metric;
  impressions: Metric;
  posts: Metric;
  engagementRate: Metric;
  growth: GrowthWindow;
  extras: PlatformExtra[];
  series: SeriesPoint[];
}

export interface ContentItem {
  id: string;
  provider: ProviderId;
  title: string;
  thumbnailUrl: string | null;
  permalink: string | null;
  publishedAt: string;
  views: Metric;
  likes: Metric;
  comments: Metric;
  shares: Metric;
  engagementRate: Metric;
}

export type InsightTone = "positive" | "neutral" | "warning";

export interface Insight {
  id: string;
  title: string;
  body: string;
  tone: InsightTone;
  /** What the observation was derived from — always shown under the insight. */
  evidence: string;
}

export interface Totals {
  reach: Metric;
  followers: Metric;
  engagement: Metric;
  engagementRate: Metric;
  views: Metric;
  published: Metric;
  growth: GrowthWindow;
}

export interface AnalyticsBundle {
  demo: boolean;
  generatedAt: string;
  rangeDays: number;
  platforms: PlatformSummary[];
  totals: Totals;
  series: SeriesPoint[];
  content: ContentItem[];
  insights: Insight[];
}

/** Sum the available values of a metric list; unavailable entries are skipped. */
export function sumMetrics(metrics: Metric[], noteWhenEmpty: string): Metric {
  const values = metrics.filter((m) => m.state === "available" && m.value !== null);
  if (values.length === 0) return unavailable(noteWhenEmpty);
  return available(values.reduce((acc, m) => acc + (m.value ?? 0), 0));
}

export function mergeSeries(all: SeriesPoint[][]): SeriesPoint[] {
  const byDate = new Map<string, SeriesPoint>();
  for (const series of all) {
    for (const point of series) {
      const existing = byDate.get(point.date);
      if (!existing) {
        byDate.set(point.date, { ...point });
        continue;
      }
      const add = (a: number | null, b: number | null) =>
        a === null && b === null ? null : (a ?? 0) + (b ?? 0);
      byDate.set(point.date, {
        date: point.date,
        followers: add(existing.followers, point.followers),
        views: add(existing.views, point.views),
        engagement: add(existing.engagement, point.engagement),
        reach: add(existing.reach, point.reach),
        posts: add(existing.posts, point.posts),
      });
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function pctChange(from: number | null, to: number | null): number | null {
  if (from === null || to === null || from === 0) return null;
  return ((to - from) / from) * 100;
}

export function growthFromSeries(
  series: SeriesPoint[],
  key: "followers" | "views" | "engagement",
): GrowthWindow {
  const points = series.filter((p) => p[key] !== null);
  const latest = points.at(-1)?.[key] ?? null;
  const at = (daysBack: number): number | null => {
    if (points.length === 0) return null;
    const index = points.length - 1 - daysBack;
    if (index < 0) return null;
    return points[index]?.[key] ?? null;
  };
  return {
    d7: pctChange(at(7), latest),
    d30: pctChange(at(30), latest),
    d90: pctChange(at(90), latest),
    y1: pctChange(at(365), latest),
  };
}
