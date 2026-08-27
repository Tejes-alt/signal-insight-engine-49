/**
 * Demo dataset generator.
 *
 * Produces a deterministic, clearly-labelled sample bundle so the whole product
 * surface can be evaluated before any platform credentials exist. It is never
 * written to the database and every surface that renders it shows a DEMO DATA
 * badge — demo numbers are never presented as a user's real analytics.
 *
 * Deterministic: the same seed always produces the same figures, so charts do
 * not jitter between renders or between server and client.
 */

import {
  available,
  growthFromSeries,
  mergeSeries,
  sumMetrics,
  unavailable,
  type AnalyticsBundle,
  type ContentItem,
  type Insight,
  type PlatformSummary,
  type SeriesPoint,
} from "../analytics/dashboard";
import type { ProviderId } from "../providers/registry";

/** Small deterministic PRNG (mulberry32) so demo output is stable. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const dayKey = (daysAgo: number): string => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

interface PlatformSeed {
  provider: ProviderId;
  handle: string;
  displayName: string;
  followers: number;
  dailyGrowth: number;
  viewsPerDay: number;
  engagementRate: number;
  postsPerWeek: number;
  /** Metrics this platform's API genuinely does not return. */
  gaps: Partial<Record<"reach" | "impressions" | "views" | "shares", string>>;
}

const SEEDS: PlatformSeed[] = [
  {
    provider: "youtube",
    handle: "@yourchannel",
    displayName: "Your Channel",
    followers: 48200,
    dailyGrowth: 0.0021,
    viewsPerDay: 31000,
    engagementRate: 4.6,
    postsPerWeek: 2,
    gaps: { reach: "YouTube reports impressions, not reach.", shares: "The Data API does not expose share counts." },
  },
  {
    provider: "instagram",
    handle: "@yourhandle",
    displayName: "Your Instagram",
    followers: 27400,
    dailyGrowth: 0.0034,
    viewsPerDay: 18500,
    engagementRate: 6.1,
    postsPerWeek: 5,
    gaps: {},
  },
  {
    provider: "linkedin",
    handle: "in/you",
    displayName: "Your LinkedIn",
    followers: 12800,
    dailyGrowth: 0.0042,
    viewsPerDay: 9600,
    engagementRate: 3.4,
    postsPerWeek: 3,
    gaps: { views: "LinkedIn reports impressions for posts, not view counts." },
  },
  {
    provider: "tiktok",
    handle: "@yourtiktok",
    displayName: "Your TikTok",
    followers: 63900,
    dailyGrowth: 0.0058,
    viewsPerDay: 74000,
    engagementRate: 8.2,
    postsPerWeek: 6,
    gaps: { reach: "The Display API does not return reach.", impressions: "Impressions are not exposed by the Display API." },
  },
  {
    provider: "x",
    handle: "@yourx",
    displayName: "Your X",
    followers: 9100,
    dailyGrowth: 0.0011,
    viewsPerDay: 4200,
    engagementRate: 1.9,
    postsPerWeek: 9,
    gaps: { reach: "X exposes impressions only, and only for your own posts." },
  },
  {
    provider: "facebook",
    handle: "yourpage",
    displayName: "Your Page",
    followers: 15600,
    dailyGrowth: 0.0006,
    viewsPerDay: 5100,
    engagementRate: 2.2,
    postsPerWeek: 4,
    gaps: {},
  },
];

const TITLES: Record<ProviderId, string[]> = {
  youtube: [
    "I rebuilt my studio setup from scratch",
    "The 12-minute workflow that saved my week",
    "Why nobody talks about this editing trick",
    "Answering your 40 most-asked questions",
    "A day in the life: shipping a product",
  ],
  instagram: [
    "Behind the scenes of this week's shoot",
    "3 slides that changed how I plan content",
    "Reel: the fastest way to batch a month",
    "Carousel: my full gear breakdown",
    "Sunday reset routine",
  ],
  linkedin: [
    "What 6 months of building in public taught me",
    "The hiring signal most teams ignore",
    "A framework for saying no to good ideas",
    "Numbers from our first year, unedited",
    "Why our retention doubled after one change",
  ],
  tiktok: [
    "POV: your analytics finally make sense",
    "Stop doing this in your first 3 seconds",
    "60 seconds, one very expensive lesson",
    "Reply to @creator — the full method",
    "This took 9 takes and it shows",
  ],
  x: [
    "A thread on what actually drives reach",
    "Shipped something small today",
    "Unpopular opinion about dashboards",
    "Numbers from last quarter",
    "The one-line fix that took four hours",
  ],
  facebook: [
    "Community update: what's next",
    "Photo album from the meetup",
    "We answered every question in the comments",
    "Announcing our next live session",
    "Recap of the year in one post",
  ],
};

function buildSeries(seed: PlatformSeed, days: number): SeriesPoint[] {
  const rand = rng(hash(seed.provider));
  const points: SeriesPoint[] = [];
  // Walk backwards from today's follower count to reconstruct history.
  const history: number[] = [];
  let followers = seed.followers;
  for (let i = 0; i < days; i += 1) {
    history.push(Math.round(followers));
    followers = followers / (1 + seed.dailyGrowth * (0.6 + rand() * 0.8));
  }
  history.reverse();

  for (let i = 0; i < days; i += 1) {
    const daysAgo = days - 1 - i;
    const weekday = new Date(`${dayKey(daysAgo)}T00:00:00Z`).getUTCDay();
    // Weekend lift — the pattern the insights engine later detects.
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.28 : 1;
    const noise = 0.75 + rand() * 0.5;
    const views = Math.round(seed.viewsPerDay * noise * weekendBoost);
    const engagement = Math.round((views * seed.engagementRate) / 100);
    points.push({
      date: dayKey(daysAgo),
      followers: history[i] ?? seed.followers,
      views: seed.gaps.views ? null : views,
      engagement,
      reach: seed.gaps.reach ? null : Math.round(views * 1.35),
      posts: rand() < seed.postsPerWeek / 7 ? 1 : 0,
    });
  }
  return points;
}

function buildPlatform(seed: PlatformSeed, days: number): PlatformSummary {
  const series = buildSeries(seed, Math.max(days, 366));
  const window = series.slice(-days);
  const sum = (key: "views" | "engagement" | "reach" | "posts") =>
    window.reduce((acc, p) => acc + (p[key] ?? 0), 0);
  const hasViews = !seed.gaps.views;
  const rand = rng(hash(`${seed.provider}-extras`));

  const extras: PlatformSummary["extras"] = [];
  if (seed.provider === "youtube") {
    extras.push(
      { label: "Watch time (hours)", metric: available(Math.round(sum("views") * 0.043)), format: "duration" },
      { label: "Average views / video", metric: available(Math.round(sum("views") / Math.max(sum("posts"), 1))) },
      { label: "Shares", metric: unavailable(seed.gaps.shares ?? "Not returned by this API.") },
    );
  }
  if (seed.provider === "instagram") {
    extras.push(
      { label: "Saves", metric: available(Math.round(sum("engagement") * 0.14)) },
      { label: "Profile visits", metric: available(Math.round(sum("reach") * 0.026)) },
      { label: "Following", metric: available(842) },
    );
  }
  if (seed.provider === "linkedin") {
    extras.push(
      { label: "Post impressions", metric: available(Math.round(sum("engagement") * 24.5)) },
      { label: "Reactions", metric: available(Math.round(sum("engagement") * 0.71)) },
      { label: "Profile views", metric: available(Math.round(sum("engagement") * 0.08)) },
      { label: "Views", metric: unavailable(seed.gaps.views ?? "Not returned by this API.") },
    );
  }
  if (seed.provider === "tiktok") {
    extras.push(
      { label: "Average watch %", metric: available(Math.round(38 + rand() * 12)), format: "percent" },
      { label: "Comments", metric: available(Math.round(sum("engagement") * 0.06)) },
    );
  }
  if (seed.provider === "x") {
    extras.push(
      { label: "Impressions", metric: available(Math.round(sum("engagement") * 51)) },
      { label: "Reposts", metric: available(Math.round(sum("engagement") * 0.18)) },
    );
  }
  if (seed.provider === "facebook") {
    extras.push(
      { label: "Page views", metric: available(Math.round(sum("reach") * 0.011)) },
      { label: "Reactions", metric: available(Math.round(sum("engagement") * 0.66)) },
    );
  }

  const followersNow = window.at(-1)?.followers ?? seed.followers;
  return {
    provider: seed.provider,
    accountId: `demo-${seed.provider}`,
    name: seed.displayName,
    handle: seed.handle,
    displayName: seed.displayName,
    avatarUrl: null,
    connected: true,
    lastSyncedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    followers: available(followersNow),
    views: hasViews ? available(sum("views")) : unavailable(seed.gaps.views ?? ""),
    engagement: available(sum("engagement")),
    reach: seed.gaps.reach ? unavailable(seed.gaps.reach) : available(sum("reach")),
    impressions: seed.gaps.impressions
      ? unavailable(seed.gaps.impressions)
      : available(Math.round(sum("reach") * 1.42)),
    posts: available(sum("posts")),
    engagementRate: available(Number(seed.engagementRate.toFixed(2))),
    growth: growthFromSeries(series, "followers"),
    extras,
    series: window,
  };
}

function buildContent(platforms: PlatformSummary[]): ContentItem[] {
  const items: ContentItem[] = [];
  for (const platform of platforms) {
    const rand = rng(hash(`${platform.provider}-content`));
    const titles = TITLES[platform.provider];
    titles.forEach((title, index) => {
      const views = Math.round(((platform.views.value ?? 40000) / 14) * (0.4 + rand() * 2.4));
      const likes = Math.round(views * (0.03 + rand() * 0.06));
      const comments = Math.round(likes * (0.04 + rand() * 0.08));
      const shares = Math.round(likes * (0.02 + rand() * 0.06));
      const rate = views > 0 ? ((likes + comments + shares) / views) * 100 : 0;
      items.push({
        id: `demo-${platform.provider}-${index}`,
        provider: platform.provider,
        title,
        thumbnailUrl: null,
        permalink: null,
        publishedAt: new Date(Date.now() - (index * 3 + 1) * 86400000).toISOString(),
        views: platform.views.state === "available" ? available(views) : unavailable(platform.views.note ?? ""),
        likes: available(likes),
        comments: available(comments),
        shares: available(shares),
        engagementRate: available(Number(rate.toFixed(2))),
      });
    });
  }
  return items.sort((a, b) => (b.views.value ?? 0) - (a.views.value ?? 0));
}

/** Derives the same insight types the live engine derives, from demo figures. */
export function deriveInsights(platforms: PlatformSummary[], content: ContentItem[]): Insight[] {
  const insights: Insight[] = [];
  const connected = platforms.filter((p) => p.connected);
  if (connected.length === 0) return insights;

  const fastest = [...connected]
    .filter((p) => p.growth.d30 !== null)
    .sort((a, b) => (b.growth.d30 ?? 0) - (a.growth.d30 ?? 0))[0];
  if (fastest?.growth.d30 != null) {
    insights.push({
      id: "fastest-growth",
      title: `${fastest.name} grew ${fastest.growth.d30.toFixed(1)}% this month`,
      body: `${fastest.name} is your fastest-growing audience over the last 30 days. Its follower curve is outpacing every other connected platform.`,
      tone: "positive",
      evidence: "Calculated from the follower series over the trailing 30 days.",
    });
  }

  const topRate = [...connected]
    .filter((p) => p.engagementRate.state === "available")
    .sort((a, b) => (b.engagementRate.value ?? 0) - (a.engagementRate.value ?? 0))[0];
  if (topRate?.engagementRate.value != null) {
    insights.push({
      id: "top-engagement",
      title: `${topRate.name} holds your highest engagement rate`,
      body: `At ${topRate.engagementRate.value.toFixed(1)}%, ${topRate.name} converts far more of its audience into interactions than your other platforms.`,
      tone: "positive",
      evidence: "Engagement rate = interactions ÷ views for the selected period.",
    });
  }

  // Weekend vs weekday engagement, computed from the merged series.
  const merged = mergeSeries(connected.map((p) => p.series));
  let weekend = 0;
  let weekendDays = 0;
  let weekday = 0;
  let weekdayDays = 0;
  for (const point of merged) {
    const day = new Date(`${point.date}T00:00:00Z`).getUTCDay();
    if (day === 0 || day === 6) {
      weekend += point.engagement ?? 0;
      weekendDays += 1;
    } else {
      weekday += point.engagement ?? 0;
      weekdayDays += 1;
    }
  }
  if (weekendDays > 0 && weekdayDays > 0) {
    const weekendAvg = weekend / weekendDays;
    const weekdayAvg = weekday / weekdayDays;
    const delta = weekdayAvg > 0 ? ((weekendAvg - weekdayAvg) / weekdayAvg) * 100 : 0;
    if (Math.abs(delta) > 8) {
      insights.push({
        id: "weekday-pattern",
        title:
          delta > 0
            ? `Weekends drive ${delta.toFixed(0)}% more engagement`
            : `Weekdays drive ${Math.abs(delta).toFixed(0)}% more engagement`,
        body:
          delta > 0
            ? "Your audience interacts noticeably more on Saturdays and Sundays. Publishing your strongest content late in the week compounds this."
            : "Your audience is most active on working days. Weekend posts consistently under-perform your weekday average.",
        tone: "neutral",
        evidence: `Compared ${weekendDays} weekend days against ${weekdayDays} weekdays of engagement.`,
      });
    }
  }

  const best = content[0];
  if (best) {
    insights.push({
      id: "top-content",
      title: `"${best.title}" is your top performer`,
      body: `This piece is pulling ahead of everything else in the period with a ${(best.engagementRate.value ?? 0).toFixed(1)}% engagement rate. Formats like it are worth repeating.`,
      tone: "positive",
      evidence: "Ranked across all connected platforms by total views in the selected period.",
    });
  }

  const stalling = [...connected]
    .filter((p) => p.growth.d30 !== null && (p.growth.d30 ?? 0) < 1)
    .sort((a, b) => (a.growth.d30 ?? 0) - (b.growth.d30 ?? 0))[0];
  if (stalling?.growth.d30 != null) {
    insights.push({
      id: "stalling",
      title: `${stalling.name} growth has flattened`,
      body: `${stalling.name} moved ${stalling.growth.d30.toFixed(1)}% in 30 days — the slowest of your connected platforms. Either increase cadence there or reallocate the effort.`,
      tone: "warning",
      evidence: "Follower change over the trailing 30 days versus your other platforms.",
    });
  }

  return insights;
}

export function buildDemoBundle(rangeDays: number): AnalyticsBundle {
  const days = Math.max(7, Math.min(rangeDays, 365));
  const platforms = SEEDS.map((seed) => buildPlatform(seed, days));
  const content = buildContent(platforms);
  const series = mergeSeries(platforms.map((p) => p.series));

  const views = sumMetrics(platforms.map((p) => p.views), "No connected platform reports views.");
  const engagement = sumMetrics(platforms.map((p) => p.engagement), "No engagement data available.");
  const followers = sumMetrics(platforms.map((p) => p.followers), "No follower data available.");
  const reach = sumMetrics(platforms.map((p) => p.reach), "No platform in this account reports reach.");
  const published = sumMetrics(platforms.map((p) => p.posts), "No content published in this period.");
  const rate =
    views.value && views.value > 0 && engagement.value !== null
      ? available(Number(((engagement.value / views.value) * 100).toFixed(2)))
      : unavailable("Engagement rate needs both views and interactions.");

  return {
    demo: true,
    generatedAt: new Date().toISOString(),
    rangeDays: days,
    platforms,
    totals: {
      reach,
      followers,
      engagement,
      engagementRate: rate,
      views,
      published,
      growth: growthFromSeries(series, "followers"),
    },
    series,
    content,
    insights: deriveInsights(platforms, content),
  };
}
