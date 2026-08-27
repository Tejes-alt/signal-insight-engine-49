import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, RefreshCw, Upload } from "lucide-react";
import { AppShell, Section } from "@/components/app-shell";
import { SimpleArea, SimpleBars } from "@/components/public-charts";
import { DeltaPill, Figure, SkeletonCard, formatFull, formatNumber } from "@/components/metrics";
import { PLATFORM_ACCENT, PlatformMark, platformName } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/hooks/dashboard-context";
import { SignalMap } from "@/components/signal-map";
import { EmptyField } from "@/components/signal";
import { IconAudience, IconContent, IconEngagement, IconGrowth } from "@/components/icons";
import {
  ActivityFeed,
  DataHealth,
  Milestones,
  Moments,
  SystemStatus,
  Why,
  headlineCopy,
} from "@/components/dashboard-widgets";
import { cn } from "@/lib/utils";
import type { PlatformId } from "@/lib/public/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Overview · SocialPulse" },
      {
        name: "description",
        content:
          "Your public social presence in one place: followers, content, engagement and growth measured from real snapshots.",
      },
      { property: "og:title", content: "Overview · SocialPulse" },
      {
        property: "og:description",
        content: "Followers, content and public engagement across every handle you track.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

/**
 * READINGS ROW
 * ============
 * Not four floating cards — one continuous instrument strip divided by hairline
 * rules, so the numbers read as a single measurement, the way a trading
 * terminal or a lab instrument presents a set of channels.
 */
function Reading({
  label,
  value,
  suffix,
  icon: Icon,
  note,
  why,
  to,
  accent,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  icon: typeof IconAudience;
  note?: React.ReactNode;
  why?: string;
  to?: string;
  accent?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-faint transition-colors group-hover:text-primary" />
        <span className="label-faint">{label}</span>
        {why ? <Why>{why}</Why> : null}
      </div>
      <div className="mt-3">
        <Figure
          value={value}
          {...(suffix ? { suffix, format: (n: number) => n.toFixed(1) } : {})}
          className="text-[2.1rem]"
        />
      </div>
      {note ? <div className="mt-2 text-xs text-muted-foreground">{note}</div> : null}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
        style={{ background: accent ?? "var(--color-primary)" }}
      />
    </>
  );

  const className =
    "group relative block px-5 py-6 text-left transition-colors first:pl-0 hover:bg-secondary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function friendlyName(name: string | null): string | null {
  if (!name) return null;
  const cleaned = name.replace(/['’]?s?\s*workspace$/i, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function Band({
  title,
  hint,
  children,
  className,
  aside,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className={cn("border-t border-border py-9", className)}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="section-marker label-mono">
          {title}
          {hint ? <Why>{hint}</Why> : null}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function NoHistory() {
  return (
    <p className="py-10 text-center text-sm text-faint">
      Tracking started recently — the line draws itself as readings accumulate.
    </p>
  );
}

function DashboardPage() {
  const { overview, accounts, isLoading, lastCheckedAt, refreshing, refreshAll, workspaceName } = useDashboard();
  const [selected, setSelected] = useState<PlatformId | null>(null);

  const dim = (platform: PlatformId) => selected !== null && selected !== platform;

  return (
    <AppShell>
      {/* Masthead — asymmetric, editorial, not a centred hero */}
      <Section bleed className="border-b border-border px-4 pb-9 md:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="label-faint">
              {greeting()}
              {friendlyName(workspaceName) ? `, ${friendlyName(workspaceName)}` : ""}
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.035em] md:text-[3rem]">
              {headlineCopy(overview)}
            </h1>
            <div className="mt-4">
              <SystemStatus lastCheckedAt={lastCheckedAt} refreshing={refreshing} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="press">
              <Link to="/accounts">
                <Plus className="size-4" /> Add presence
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="press">
              <Link to="/import">
                <Upload className="size-4" /> Import
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="press"
              disabled={refreshing}
              onClick={() => void refreshAll()}
            >
              <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} /> Refresh
            </Button>
          </div>
        </div>
      </Section>

      {isLoading ? (
        <div className="grid gap-4 pt-8 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={1} />
          ))}
        </div>
      ) : accounts.length === 0 || !overview ? (
        <div className="pt-10">
          <EmptyField
            title="No signal yet"
            body="Add your handles and SocialPulse reads what those profiles publish openly. No passwords, no developer setup, nothing invented."
            action={
              <Button asChild size="sm">
                <Link to="/accounts">Add your first presence</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div>
          {/* Instrument strip */}
          <div className="grid divide-y divide-border border-b border-border sm:grid-cols-2 sm:divide-x xl:grid-cols-4">
            <Reading
              label="Total audience"
              value={overview.totals.followers}
              icon={IconAudience}
              to="/analytics"
              why="Sum of the follower counts recorded for every profile you track."
              note={
                <DeltaPill value={overview.totals.followerGrowth} label="since first reading" />
              }
            />
            <Reading
              label="Public engagement"
              value={overview.totals.publicEngagement}
              icon={IconEngagement}
              accent="var(--color-instagram)"
              to="/analytics"
              why="Likes and comments counted on the public content SocialPulse retrieved or you imported."
              note="Counted on retrieved public content"
            />
            <Reading
              label="Content records"
              value={overview.totals.content}
              icon={IconContent}
              accent="var(--color-youtube)"
              to="/content"
              why="Number of content records currently stored for your profiles."
              note="Stored in your workspace"
            />
            <Reading
              label="Engagement rate"
              value={overview.totals.avgEngagementRate}
              suffix="%"
              icon={IconGrowth}
              accent="var(--color-tiktok)"
              to="/analytics"
              why="Calculated from recorded engagement relative to followers — never estimated."
              note="Relative to recorded audience"
            />
          </div>

          {/* Signal map + audience trend share one band: map on the left, the
              dominant series on the right. Selecting a platform dims the rest. */}
          <Band
            title="Audience trend"
            hint="Every point is a stored reading. Nothing between readings is interpolated."
            aside={
              selected ? (
                <button
                  onClick={() => setSelected(null)}
                  className="press label-faint transition-colors hover:text-foreground"
                >
                  clear selection ✕
                </button>
              ) : null
            }
          >
            <div className="grid gap-8 xl:grid-cols-[22rem_minmax(0,1fr)]">
              <SignalMap accounts={accounts} selected={selected} onSelect={setSelected} />
              <div className="pulse-grid rounded-md">
                {overview.hasHistory && overview.followerSeries.length > 1 ? (
                  <SimpleArea data={overview.followerSeries} xKey="date" yKey="total" label="Followers" />
                ) : (
                  <NoHistory />
                )}
              </div>
            </div>
          </Band>

          <Band title="Engagement & rhythm">
            <div className="grid gap-10 xl:grid-cols-2">
              <div>
                <p className="mb-3 text-xs text-muted-foreground">Public engagement over time</p>
                <div className="pulse-grid rounded-md">
                  {overview.engagementSeries.length > 1 ? (
                    <SimpleArea
                      data={overview.engagementSeries}
                      xKey="date"
                      yKey="value"
                      label="Engagement"
                      color="var(--color-instagram)"
                      height={240}
                    />
                  ) : (
                    <NoHistory />
                  )}
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs text-muted-foreground">Publishing rhythm, by week</p>
                <div className="pulse-grid rounded-md">
                  {overview.postingFrequency.length > 0 ? (
                    <SimpleBars
                      data={overview.postingFrequency}
                      xKey="week"
                      yKey="count"
                      label="Posts"
                      color="var(--color-youtube)"
                      height={240}
                    />
                  ) : (
                    <p className="py-10 text-center text-sm text-faint">No public post timestamps recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </Band>

          <Band title="Standouts">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <Moments overview={overview} />
              <div className="space-y-7">
                <div>
                  <p className="label-faint">Largest presence</p>
                  {overview.topPlatform ? (
                    <div className="mt-3 flex items-center gap-3">
                      <PlatformMark provider={overview.topPlatform.platform} size="lg" />
                      <div>
                        <p className="font-display text-lg font-semibold">
                          {platformName(overview.topPlatform.platform)}
                        </p>
                        <p className="figure text-sm">{formatFull(overview.topPlatform.followers)} followers</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-faint">No follower counts recorded yet.</p>
                  )}
                </div>
                <div>
                  <p className="label-faint">Strongest content</p>
                  {overview.topContent ? (
                    <a
                      href={overview.topContent.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="press mt-3 block border-l-2 border-primary/60 pl-3 transition-colors hover:border-primary"
                    >
                      <p className="line-clamp-2 text-sm font-medium">{overview.topContent.title ?? "Untitled"}</p>
                      <p className="figure mt-1 text-xs">
                        {formatNumber(overview.topContent.likes ?? 0)} likes ·{" "}
                        {formatNumber(overview.topContent.views ?? 0)} views
                      </p>
                    </a>
                  ) : (
                    <p className="mt-3 text-sm text-faint">No public content recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </Band>

          <Band title="Log & integrity">
            <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <ActivityFeed accounts={accounts} selected={selected} />
              <div className="space-y-9">
                <DataHealth overview={overview} />
                <Milestones followers={overview.totals.followers} />
              </div>
            </div>
          </Band>

          <Band title="Tracked presences">
            <ul className="grid divide-y divide-border border-y border-border md:grid-cols-2 md:divide-x xl:grid-cols-3">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  onMouseEnter={() => setSelected(account.platform)}
                  onMouseLeave={() => setSelected(null)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-4 transition-all duration-200 hover:bg-secondary/25",
                    dim(account.platform) && "opacity-35",
                  )}
                >
                  <PlatformMark provider={account.platform} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{account.displayName ?? account.handle}</p>
                    <p className="label-faint truncate">{account.handle}</p>
                  </div>
                  <p className="figure text-lg" style={{ color: PLATFORM_ACCENT[account.platform] }}>
                    {account.metrics.followers === null || account.metrics.followers === undefined
                      ? "—"
                      : formatNumber(account.metrics.followers)}
                  </p>
                </li>
              ))}
            </ul>
          </Band>
        </div>
      )}
    </AppShell>
  );
}
