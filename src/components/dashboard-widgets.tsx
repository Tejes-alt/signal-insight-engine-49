import { Activity, CheckCircle2, Flame, Info, Sparkles, TriangleAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PlatformMark, platformName } from "@/components/platform";
import { formatNumber } from "@/components/metrics";
import { cn } from "@/lib/utils";
import type { OverviewBundle, PublicAccountView } from "@/lib/public/types";

export function Why({ children }: { children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="How this is calculated"
          className="inline-grid size-4 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  );
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const seconds = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

const SOURCE_LABEL: Record<string, string> = {
  public: "Public profile reading",
  manual: "Manual entry",
  import: "File import",
  screenshot: "Screenshot reading",
};

/** Real activity, derived from the snapshots and content already stored. */
export function ActivityFeed({ accounts }: { accounts: PublicAccountView[] }) {
  const events = accounts
    .flatMap((account) => [
      ...account.history.slice(-4).map((snapshot) => ({
        id: `${account.id}-${snapshot.id ?? snapshot.capturedAt}`,
        at: snapshot.capturedAt,
        platform: account.platform,
        text: `${SOURCE_LABEL[snapshot.source ?? "public"] ?? "Snapshot"} recorded for ${account.handle}`,
      })),
      ...account.content
        .filter((item) => item.publishedAt)
        .slice(0, 3)
        .map((item) => ({
          id: `${account.id}-${item.externalId}`,
          at: item.publishedAt as string,
          platform: account.platform,
          text: `Content on ${platformName(account.platform)}: ${item.title ?? "Untitled"}`,
        })),
    ])
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 8);

  return (
    <section className="panel p-5">
      <h2 className="label-mono">Recent activity</h2>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <ul className="stagger mt-4 space-y-1">
          {events.map((event) => (
            <li key={event.id} className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-secondary/40">
              <PlatformMark provider={event.platform} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{event.text}</p>
                <p className="label-mono text-[0.62rem]">{relativeTime(event.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const MILESTONES = [1_000, 10_000, 25_000, 50_000, 100_000, 500_000, 1_000_000];

export function Milestones({ followers }: { followers: number | null }) {
  if (followers === null) return null;
  const reached = MILESTONES.filter((m) => followers >= m);
  const next = MILESTONES.find((m) => followers < m) ?? null;

  return (
    <section className="panel p-5">
      <h2 className="label-mono">Milestones</h2>
      {reached.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Your first milestone is {formatNumber(next ?? 1000)} followers.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {reached.map((m) => (
            <span
              key={m}
              className="relative inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success"
            >
              <Flame className="size-3" />
              {formatNumber(m, 0)} followers
            </span>
          ))}
        </div>
      )}
      {next ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Next: {formatNumber(next, 0)}</span>
            <span className="tabular">{Math.round((followers / next) * 100)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.min(100, (followers / next) * 100)}%`, background: "var(--gradient-brand)" }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Genuinely calculated from what has actually been recorded. */
export function DataHealth({ overview }: { overview: OverviewBundle }) {
  const checks = [
    { label: "Followers", ok: overview.totals.followers !== null },
    { label: "Engagement", ok: overview.totals.avgEngagementRate !== null },
    { label: "Content", ok: (overview.totals.content ?? 0) > 0 },
    { label: "Historical data", ok: overview.hasHistory && overview.followerSeries.length > 2 },
    {
      label: "Recent update",
      ok: Boolean(
        overview.lastCheckedAt && Date.now() - Date.parse(overview.lastCheckedAt) < 1000 * 60 * 60 * 24 * 7,
      ),
    },
  ];
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

  return (
    <section className="panel p-5">
      <div className="flex items-center gap-2">
        <h2 className="label-mono">Data health</h2>
        <Why>Based on the completeness and recency of the analytics recorded in your workspace.</Why>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular">{score}%</p>
      <ul className="mt-4 space-y-2">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-2 text-sm">
            {check.ok ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <TriangleAlert className="size-4 text-warning" />
            )}
            <span className={cn(check.ok ? "text-foreground" : "text-muted-foreground")}>
              {check.label}
              {check.ok ? "" : " limited"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SystemStatus({ lastCheckedAt, refreshing }: { lastCheckedAt: string | null; refreshing: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="flex items-center gap-2 font-semibold tracking-wide text-success">
        <span className="live-dot" />
        {refreshing ? "SYNCHRONIZING" : "DATA SYSTEM OPERATIONAL"}
      </span>
      <span className="text-muted-foreground">
        Last synchronized <span className="tabular">{relativeTime(lastCheckedAt)}</span>
      </span>
    </div>
  );
}

/** Copy that only ever describes what the data actually shows. */
export function headlineCopy(overview: OverviewBundle | undefined): string {
  if (!overview) return "Add a profile and SocialPulse starts building your history.";
  const growth = overview.totals.followerGrowth;
  if (growth !== null && overview.totals.followers) {
    const pct = (growth / Math.max(1, overview.totals.followers - growth)) * 100;
    return `Your audience ${growth >= 0 ? "grew" : "fell"} ${Math.abs(pct).toFixed(1)}% since your first recorded snapshot.`;
  }
  if (overview.topPlatform) {
    return `${platformName(overview.topPlatform.platform)} is currently your largest platform by followers.`;
  }
  return "Not enough history yet to identify a growth trend.";
}

export function Moments({ overview }: { overview: OverviewBundle }) {
  const moments: { icon: typeof Sparkles; title: string; detail: string }[] = [];
  if (overview.topContent) {
    moments.push({
      icon: Sparkles,
      title: "Best performing content",
      detail: `${overview.topContent.title ?? "Untitled"} — ${formatNumber(
        overview.topContent.likes ?? 0,
      )} likes, ${formatNumber(overview.topContent.views ?? 0)} views.`,
    });
  }
  if (overview.topPlatform) {
    moments.push({
      icon: Activity,
      title: "Largest platform",
      detail: `${platformName(overview.topPlatform.platform)} with ${formatNumber(
        overview.topPlatform.followers,
      )} followers.`,
    });
  }
  const busiest = [...overview.postingFrequency].sort((a, b) => b.count - a.count)[0];
  if (busiest && busiest.count > 0) {
    moments.push({
      icon: Flame,
      title: "Most active week",
      detail: `${busiest.count} piece${busiest.count === 1 ? "" : "s"} of content in the week of ${new Date(
        busiest.week,
      ).toLocaleDateString()}.`,
    });
  }
  if (moments.length === 0) return null;

  return (
    <section className="panel p-5">
      <h2 className="label-mono">Moments</h2>
      <div className="stagger mt-4 grid gap-3 md:grid-cols-3">
        {moments.map((moment) => {
          const Icon = moment.icon;
          return (
            <div key={moment.title} className="rounded-xl border border-border bg-secondary/25 p-4">
              <Icon className="size-4 text-primary" />
              <p className="mt-2 text-sm font-semibold">{moment.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{moment.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
