import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PLATFORM_ACCENT, platformName } from "@/components/platform";
import { formatNumber } from "@/components/metrics";
import { HealthPulse, EvidenceSpark } from "@/components/signal";
import { IconGrowth, IconContent, IconMilestone, IconActivity } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { OverviewBundle, PlatformId, PublicAccountView } from "@/lib/public/types";

export function Why({ children }: { children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="How this is calculated"
          className="inline-grid size-3.5 place-items-center rounded-sm text-faint transition-colors hover:text-foreground"
        >
          <Info className="size-3" />
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
  public: "Public reading",
  manual: "Manual entry",
  import: "File import",
  screenshot: "Screenshot reading",
};

/**
 * ACTIVITY HISTORY — a timeline, not a card list. Everything is drawn from
 * snapshots and content already stored.
 */
export function ActivityFeed({
  accounts,
  selected,
}: {
  accounts: PublicAccountView[];
  selected?: PlatformId | null;
}) {
  const events = accounts
    .flatMap((account) => [
      ...account.history.slice(-4).map((snapshot) => ({
        id: `${account.id}-${snapshot.id ?? snapshot.capturedAt}`,
        at: snapshot.capturedAt,
        platform: account.platform,
        kind: SOURCE_LABEL[snapshot.source ?? "public"] ?? "Snapshot",
        text: `${account.handle}`,
      })),
      ...account.content
        .filter((item) => item.publishedAt)
        .slice(0, 3)
        .map((item) => ({
          id: `${account.id}-${item.externalId}`,
          at: item.publishedAt as string,
          platform: account.platform,
          kind: "Content",
          text: item.title ?? "Untitled",
        })),
    ])
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 9);

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>;
  }

  return (
    <ol className="relative">
      <span className="absolute bottom-2 left-[3px] top-2 w-px bg-border" aria-hidden />
      {events.map((event) => {
        const dim = selected != null && selected !== event.platform;
        return (
          <li key={event.id} className="relative flex gap-4 py-2.5 pl-5" data-dimmed={dim}>
            <span
              className="absolute left-0 top-[1.05rem] size-[7px] rounded-full ring-4 ring-background"
              style={{ background: PLATFORM_ACCENT[event.platform] }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{event.text}</p>
              <p className="label-faint mt-0.5">
                {event.kind} · {platformName(event.platform)} · {relativeTime(event.at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const MILESTONES = [1_000, 10_000, 25_000, 50_000, 100_000, 500_000, 1_000_000];

export function Milestones({ followers }: { followers: number | null }) {
  if (followers === null) return null;
  const reached = MILESTONES.filter((m) => followers >= m);
  const next = MILESTONES.find((m) => followers < m) ?? null;
  const progress = next ? Math.min(100, (followers / next) * 100) : 100;

  return (
    <div>
      <p className="section-marker label-mono">Milestones</p>
      {reached.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          First threshold at {formatNumber(next ?? 1000, 0)} followers.
        </p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {reached.slice(-3).map((m) => (
            <li key={m} className="flex items-center gap-2 text-sm">
              <IconMilestone size={14} className="text-primary" />
              <span className="tabular">{formatNumber(m, 0)}</span>
              <span className="text-faint">crossed</span>
            </li>
          ))}
        </ul>
      )}
      {next ? (
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="label-faint">Next {formatNumber(next, 0)}</span>
            <span className="font-mono text-xs tabular text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function healthChecks(overview: OverviewBundle) {
  return [
    { label: "Follower coverage", ok: overview.totals.followers !== null },
    { label: "Engagement coverage", ok: overview.totals.avgEngagementRate !== null },
    { label: "Content records", ok: (overview.totals.content ?? 0) > 0 },
    { label: "Historical depth", ok: overview.hasHistory && overview.followerSeries.length > 2 },
    {
      label: "Recency",
      ok: Boolean(
        overview.lastCheckedAt && Date.now() - Date.parse(overview.lastCheckedAt) < 1000 * 60 * 60 * 24 * 7,
      ),
    },
  ];
}

export function DataHealth({ overview }: { overview: OverviewBundle }) {
  const checks = healthChecks(overview);
  return (
    <div>
      <p className="section-marker label-mono">
        Data health
        <Why>Measured from the completeness, depth and recency of the readings stored in your workspace.</Why>
      </p>
      <div className="mt-4">
        <HealthPulse checks={checks} size={116} />
      </div>
      <ul className="mt-5 space-y-1.5">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center justify-between gap-3 text-sm">
            <span className={cn(check.ok ? "text-foreground" : "text-faint")}>{check.label}</span>
            <span className={cn("font-mono text-[0.65rem] uppercase tracking-[0.14em]", check.ok ? "text-primary" : "text-faint")}>
              {check.ok ? "ok" : "limited"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SystemStatus({ lastCheckedAt, refreshing }: { lastCheckedAt: string | null; refreshing: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
      <span className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-primary">
        <span className="live-dot" />
        {refreshing ? "Reading signals" : "System nominal"}
      </span>
      <span className="label-faint">
        Last reading <span className="tabular">{relativeTime(lastCheckedAt)}</span>
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
    return `Audience ${growth >= 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% since the first recorded reading.`;
  }
  if (overview.topPlatform) {
    return `${platformName(overview.topPlatform.platform)} is currently your largest platform by audience.`;
  }
  return "Not enough history yet to read a trend.";
}

/**
 * MOMENTS — meaningful events detected in the user's own data, laid out as a
 * horizontal timeline with pulse markers. A signature surface, not a card row.
 */
export function Moments({ overview }: { overview: OverviewBundle }) {
  type Moment = {
    kind: string;
    headline: string;
    detail: string;
    icon: typeof IconGrowth;
    spark?: number[];
  };
  const moments: Moment[] = [];

  if (overview.totals.followerGrowth !== null && overview.followerSeries.length > 1) {
    moments.push({
      kind: "Growth signal",
      headline: `${overview.totals.followerGrowth >= 0 ? "+" : ""}${formatNumber(overview.totals.followerGrowth)}`,
      detail: "Net audience change across all tracked readings.",
      icon: IconGrowth,
      spark: overview.followerSeries.map((p) => p.total),
    });
  }
  if (overview.topContent) {
    moments.push({
      kind: "Content signal",
      headline: overview.topContent.title ?? "Untitled",
      detail: `${formatNumber(overview.topContent.likes ?? 0)} likes · ${formatNumber(
        overview.topContent.views ?? 0,
      )} views`,
      icon: IconContent,
    });
  }
  if (overview.topPlatform) {
    moments.push({
      kind: "Audience signal",
      headline: platformName(overview.topPlatform.platform),
      detail: `${formatNumber(overview.topPlatform.followers)} followers — your largest presence.`,
      icon: IconActivity,
    });
  }
  const busiest = [...overview.postingFrequency].sort((a, b) => b.count - a.count)[0];
  if (busiest && busiest.count > 0) {
    moments.push({
      kind: "Consistency signal",
      headline: `${busiest.count} post${busiest.count === 1 ? "" : "s"}`,
      detail: `Most active week, from ${new Date(busiest.week).toLocaleDateString()}.`,
      icon: IconMilestone,
      spark: overview.postingFrequency.map((p) => p.count),
    });
  }

  if (moments.length === 0) return null;

  return (
    <section aria-labelledby="moments-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="moments-heading" className="section-marker label-mono">
          Moments
        </h2>
        <p className="label-faint">Detected in your data</p>
      </div>

      <div className="relative mt-6">
        <span className="absolute left-0 right-0 top-[5px] h-px bg-border" aria-hidden />
        <ol className="grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
          {moments.map((moment) => {
            const Icon = moment.icon;
            return (
              <li key={moment.kind} className="relative pt-6">
                <span className="absolute left-0 top-0 size-[11px] rounded-full border border-primary bg-background" aria-hidden />
                <span
                  className="absolute left-0 top-0 size-[11px] rounded-full bg-primary/40 halo-ring"
                  aria-hidden
                />
                <p className="label-faint flex items-center gap-1.5">
                  <Icon size={12} className="text-primary" />
                  {moment.kind}
                </p>
                <p className="mt-2 line-clamp-2 font-display text-lg font-semibold tracking-tight">
                  {moment.headline}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{moment.detail}</p>
                {moment.spark ? (
                  <div className="mt-3 text-primary">
                    <EvidenceSpark values={moment.spark} width={110} height={24} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
