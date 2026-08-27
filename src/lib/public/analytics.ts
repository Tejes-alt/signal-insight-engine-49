/**
 * Analytics computed strictly from retrieved public data.
 *
 * Nothing here invents a number: growth needs two real snapshots, averages need
 * real content, and anything a platform doesn't publish stays absent.
 */

import type {
  ContentRow,
  GrowthSummary,
  Insight,
  OverviewBundle,
  PublicAccountView,
  SnapshotPoint,
} from "./types";
import { platformName } from "../social/platforms";

const DAY = 86_400_000;

export function summarizeGrowth(history: SnapshotPoint[], firstTrackedAt: string): GrowthSummary {
  const points = history
    .filter((p) => typeof p.followers === "number")
    .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
  const trackedSinceDays = Math.max(0, Math.floor((Date.now() - Date.parse(firstTrackedAt)) / DAY));

  if (points.length < 2) {
    return {
      delta: null,
      percent: null,
      perWeek: null,
      trackedSinceDays,
      snapshotCount: points.length,
      note:
        points.length === 0
          ? "No public follower count retrieved yet."
          : trackedSinceDays === 0
            ? "Tracking started today."
            : "Tracking started recently — more history will appear automatically.",
    };
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const delta = (last.followers ?? 0) - (first.followers ?? 0);
  const spanDays = Math.max(
    (Date.parse(last.capturedAt) - Date.parse(first.capturedAt)) / DAY,
    0.5,
  );
  const base = first.followers ?? 0;
  return {
    delta,
    percent: base > 0 ? (delta / base) * 100 : null,
    perWeek: Math.round((delta / spanDays) * 7),
    trackedSinceDays,
    snapshotCount: points.length,
    note: `${delta >= 0 ? "+" : ""}${delta.toLocaleString()} followers since tracking started`,
  };
}

export function engagementRate(account: {
  followers: number | null | undefined;
  avgLikes: number | null;
  avgComments: number | null;
}): number | null {
  const followers = account.followers ?? null;
  if (!followers || followers <= 0) return null;
  const likes = account.avgLikes;
  const comments = account.avgComments;
  if (likes === null && comments === null) return null;
  return (((likes ?? 0) + (comments ?? 0)) / followers) * 100;
}

export function postingFrequency(content: ContentRow[]): number | null {
  const dates = content
    .map((c) => (c.publishedAt ? Date.parse(c.publishedAt) : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (dates.length < 2) return null;
  const spanDays = Math.max((dates[dates.length - 1]! - dates[0]!) / DAY, 1);
  return Number(((dates.length / spanDays) * 7).toFixed(1));
}

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

export function buildOverview(accounts: PublicAccountView[], rangeDays: number): OverviewBundle {
  const active = accounts.filter((a) => a.status === "available" || a.status === "partial");
  const since = Date.now() - rangeDays * DAY;

  const sum = (values: (number | null | undefined)[]) => {
    const nums = values.filter((v): v is number => typeof v === "number");
    return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
  };

  const followers = sum(active.map((a) => a.metrics.followers));
  const content = sum(active.map((a) => a.metrics.posts));
  const engagement = sum(
    active.flatMap((a) => a.content.flatMap((c) => [c.likes ?? null, c.comments ?? null])),
  );
  const rates = active.map((a) => a.engagementRate).filter((v): v is number => v !== null);
  const growthValues = active.map((a) => a.growth.delta).filter((v): v is number => v !== null);

  const topPlatform = active
    .filter((a) => typeof a.metrics.followers === "number")
    .sort((a, b) => (b.metrics.followers ?? 0) - (a.metrics.followers ?? 0))[0];

  const allContent = active.flatMap((a) => a.content);
  const topContent =
    allContent
      .filter((c) => typeof c.views === "number" || typeof c.likes === "number")
      .sort((a, b) => (b.views ?? b.likes ?? 0) - (a.views ?? a.likes ?? 0))[0] ?? null;

  // Follower series from real snapshots only.
  const dateTotals = new Map<string, Map<string, number>>();
  for (const account of active) {
    for (const point of account.history) {
      if (typeof point.followers !== "number") continue;
      if (Date.parse(point.capturedAt) < since) continue;
      const day = point.capturedAt.slice(0, 10);
      const perAccount = dateTotals.get(day) ?? new Map<string, number>();
      perAccount.set(account.id, point.followers);
      dateTotals.set(day, perAccount);
    }
  }
  const followerSeries = [...dateTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, perAccount]) => ({
      date,
      total: [...perAccount.values()].reduce((a, b) => a + b, 0),
    }));

  const engagementByDay = new Map<string, number>();
  const weeks = new Map<string, number>();
  for (const item of allContent) {
    if (!item.publishedAt) continue;
    const time = Date.parse(item.publishedAt);
    if (!Number.isFinite(time) || time < since) continue;
    const day = new Date(time).toISOString().slice(0, 10);
    engagementByDay.set(day, (engagementByDay.get(day) ?? 0) + (item.likes ?? 0) + (item.comments ?? 0));
    const week = isoWeek(new Date(time));
    weeks.set(week, (weeks.get(week) ?? 0) + 1);
  }

  const lastCheckedAt =
    accounts
      .map((a) => a.lastCheckedAt)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null;

  return {
    accounts,
    totals: {
      followers,
      content,
      publicEngagement: engagement,
      avgEngagementRate: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
      followerGrowth: growthValues.length ? growthValues.reduce((a, b) => a + b, 0) : null,
    },
    topPlatform: topPlatform
      ? { platform: topPlatform.platform, followers: topPlatform.metrics.followers ?? 0 }
      : null,
    topContent,
    followerSeries,
    engagementSeries: [...engagementByDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value })),
    postingFrequency: [...weeks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, count]) => ({ week, count })),
    insights: buildInsights(active),
    lastCheckedAt,
    hasHistory: followerSeries.length > 1,
  };
}

export function buildInsights(accounts: PublicAccountView[]): Insight[] {
  const insights: Insight[] = [];
  if (!accounts.length) return insights;

  const withRate = accounts.filter((a) => a.engagementRate !== null);
  if (withRate.length) {
    const best = withRate.sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))[0]!;
    insights.push({
      id: "best-engagement",
      title: `Your ${platformName(best.platform)} content earns the highest public engagement`,
      detail: `${best.engagementRate!.toFixed(2)}% of followers like or comment on an average post.`,
      tone: "positive",
    });
  }

  const weekAgo = Date.now() - 7 * DAY;
  const postedThisWeek = accounts.flatMap((a) =>
    a.content.filter((c) => c.publishedAt && Date.parse(c.publishedAt) >= weekAgo),
  );
  if (postedThisWeek.length) {
    insights.push({
      id: "weekly-output",
      title: `You published ${postedThisWeek.length} ${postedThisWeek.length === 1 ? "post" : "posts"} this week`,
      detail: "Counted from the public timestamps on your retrieved content.",
      tone: "info",
    });
  }

  for (const account of accounts) {
    const views = account.content.map((c) => c.views).filter((v): v is number => typeof v === "number");
    if (views.length < 3) continue;
    const avg = views.reduce((a, b) => a + b, 0) / views.length;
    const latest = account.content
      .filter((c) => c.publishedAt && typeof c.views === "number")
      .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!))[0];
    if (latest && avg > 0 && (latest.views ?? 0) > avg * 1.25) {
      insights.push({
        id: `outperform-${account.id}`,
        title: `Your latest ${platformName(account.platform)} post received ${((latest.views ?? 0) / avg).toFixed(1)}× your average public views`,
        detail: `${(latest.views ?? 0).toLocaleString()} views versus an average of ${Math.round(avg).toLocaleString()}.`,
        tone: "positive",
      });
    }
  }

  const noHistory = accounts.filter((a) => a.growth.snapshotCount < 2);
  if (noHistory.length === accounts.length) {
    insights.push({
      id: "no-history",
      title: "Not enough historical data yet to calculate growth",
      detail: "Refresh again over the next few days and growth will appear automatically.",
      tone: "neutral",
    });
  }

  return insights;
}
