import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Activity, Download, Eye, Heart, Layers, Plus, RefreshCw, Upload, Users } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { SimpleArea, SimpleBars } from "@/components/public-charts";
import { AnimatedNumber, EmptyState, SkeletonCard, formatNumber } from "@/components/metrics";
import { PLATFORM_ACCENT, PlatformMark, platformName } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/hooks/dashboard-context";
import { PulseRing } from "@/components/pulse-ring";
import { PlatformOrbit } from "@/components/platform-orbit";
import {
  ActivityFeed,
  DataHealth,
  Milestones,
  Moments,
  SystemStatus,
  Why,
  headlineCopy,
} from "@/components/dashboard-widgets";

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

function Stat({
  label,
  value,
  suffix,
  icon,
  accent,
  note,
  why,
  to,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  icon: React.ReactNode;
  accent?: string;
  note?: string;
  why?: string;
  to?: string;
}) {
  const navigate = useNavigate();
  return (
    <div
      role={to ? "button" : undefined}
      tabIndex={to ? 0 : undefined}
      onClick={to ? () => void navigate({ to }) : undefined}
      onKeyDown={
        to
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void navigate({ to });
              }
            }
          : undefined
      }
      className="panel panel-hover press group relative overflow-hidden p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[clickable=true]:cursor-pointer"
      data-clickable={to ? "true" : "false"}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-45"
        style={{ background: accent ?? "var(--color-primary)" }}
      />
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-1.5">
          <span className="label-mono">{label}</span>
          {why ? <Why>{why}</Why> : null}
        </span>
        <span className="grid size-8 place-items-center rounded-lg bg-secondary/70 text-muted-foreground transition-colors group-hover:text-foreground">
          {icon}
        </span>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tracking-tight">
        {value === null ? (
          <span className="text-base font-normal text-muted-foreground">Not recorded yet</span>
        ) : (
          <>
            <AnimatedNumber value={value} format={suffix ? (n) => n.toFixed(1) : formatNumber} />
            {suffix}
          </>
        )}
      </div>
      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardPage() {
  const { overview, accounts, isLoading, lastCheckedAt, refreshing, refreshAll, workspaceName } = useDashboard();

  return (
    <AppShell>
      <header className="animate-rise mb-7">
        <p className="label-mono">{greeting()}{workspaceName ? `, ${workspaceName}` : ""}.</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
          Your social presence, <span className="gradient-text">quantified</span>.
        </h1>
        <div className="mt-3">
          <SystemStatus lastCheckedAt={lastCheckedAt} refreshing={refreshing} />
        </div>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{headlineCopy(overview)}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="press">
            <Link to="/accounts">
              <Plus className="size-4" /> Add account
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="press">
            <Link to="/import">
              <Upload className="size-4" /> Import analytics
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="press" disabled={refreshing} onClick={() => void refreshAll()}>
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} /> Refresh data
          </Button>
          <Button asChild size="sm" variant="ghost" className="press">
            <Link to="/import">
              <Download className="size-4" /> Export report
            </Link>
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={1} />
          ))}
        </div>
      ) : accounts.length === 0 || !overview ? (
        <EmptyState
          title="Nothing tracked yet"
          body="Add your social handles and SocialPulse will analyze the information those profiles share publicly. No passwords, no developer setup."
          icon={<Activity className="size-5" />}
          action={
            <Button asChild className="mt-2">
              <Link to="/accounts">Add your first account</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Total followers"
              value={overview.totals.followers}
              icon={<Users className="size-4" />}
              to="/analytics"
              why="Sum of the follower counts recorded for every profile you track."
              note={
                overview.totals.followerGrowth === null
                  ? "Tracking started recently — growth appears automatically."
                  : `${overview.totals.followerGrowth >= 0 ? "+" : ""}${formatNumber(
                      overview.totals.followerGrowth,
                    )} since first tracked`
              }
            />
            <Stat
              label="Public engagement"
              value={overview.totals.publicEngagement}
              icon={<Heart className="size-4" />}
              accent="var(--color-instagram)"
              to="/analytics"
              why="Likes and comments counted on the public content SocialPulse retrieved or you imported."
              note="Likes and comments on retrieved public content."
            />
            <Stat
              label="Total content"
              value={overview.totals.content}
              icon={<Layers className="size-4" />}
              accent="var(--color-youtube)"
              to="/content"
              why="Number of content records currently stored for your profiles."
            />
            <Stat
              label="Avg engagement rate"
              value={overview.totals.avgEngagementRate}
              suffix="%"
              icon={<Eye className="size-4" />}
              accent="var(--color-tiktok)"
              to="/analytics"
              why="Calculated from the engagement metrics available in your recorded data, relative to followers."
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <section className="panel p-5 xl:col-span-2">
              <h2 className="font-display text-base font-semibold">Follower growth</h2>
              {overview.hasHistory && overview.followerSeries.length > 1 ? (
                <div className="mt-4">
                  <SimpleArea data={overview.followerSeries} xKey="date" yKey="total" label="Followers" />
                </div>
              ) : (
                <p className="mt-6 text-sm text-muted-foreground">
                  Tracking started recently — more history will appear automatically.
                </p>
              )}
            </section>

            <section className="panel p-5">
              <h2 className="font-display text-base font-semibold">Top platform</h2>
              {overview.topPlatform ? (
                <div className="mt-4 flex items-center gap-3">
                  <PlatformMark provider={overview.topPlatform.platform} size="lg" />
                  <div>
                    <p className="font-display text-lg font-semibold">
                      {platformName(overview.topPlatform.platform)}
                    </p>
                    <p className="text-sm text-muted-foreground tabular">
                      {formatNumber(overview.topPlatform.followers)} followers
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">No follower counts retrieved yet.</p>
              )}

              <h3 className="mt-6 font-display text-base font-semibold">Top content</h3>
              {overview.topContent ? (
                <a
                  href={overview.topContent.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block rounded-xl border border-border p-3 transition-colors hover:bg-secondary/50"
                >
                  <p className="line-clamp-2 text-sm font-medium">{overview.topContent.title ?? "Untitled"}</p>
                  <p className="mt-1 text-xs text-muted-foreground tabular">
                    {formatNumber(overview.topContent.likes ?? 0)} likes ·{" "}
                    {formatNumber(overview.topContent.views ?? 0)} views
                  </p>
                </a>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No public content retrieved yet.</p>
              )}
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="panel p-5">
              <h2 className="font-display text-base font-semibold">Public engagement</h2>
              {overview.engagementSeries.length > 1 ? (
                <div className="mt-4">
                  <SimpleArea
                    data={overview.engagementSeries}
                    xKey="date"
                    yKey="value"
                    label="Engagement"
                    color="var(--color-instagram)"
                  />
                </div>
              ) : (
                <p className="mt-6 text-sm text-muted-foreground">
                  Tracking started recently — more history will appear automatically.
                </p>
              )}
            </section>
            <section className="panel p-5">
              <h2 className="font-display text-base font-semibold">Posting frequency</h2>
              {overview.postingFrequency.length > 0 ? (
                <div className="mt-4">
                  <SimpleBars
                    data={overview.postingFrequency}
                    xKey="week"
                    yKey="count"
                    label="Posts"
                    color="var(--color-youtube)"
                  />
                </div>
              ) : (
                <p className="mt-6 text-sm text-muted-foreground">No public post timestamps retrieved yet.</p>
              )}
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <section className="panel ambient relative overflow-hidden p-5 xl:col-span-2">
              <h2 className="label-mono">Your ecosystem</h2>
              <PlatformOrbit accounts={accounts} />
            </section>
            <section className="panel p-5">
              <h2 className="label-mono">Audience pulse</h2>
              <PulseRing total={overview.totals.followers} />
              <p className="text-center text-xs text-muted-foreground">
                Measured from your most recent recorded snapshots.
              </p>
            </section>
          </div>

          <Moments overview={overview} />

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ActivityFeed accounts={accounts} />
            </div>
            <div className="space-y-5">
              <DataHealth overview={overview} />
              <Milestones followers={overview.totals.followers} />
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <div key={account.id} className="panel panel-hover flex items-center gap-3 p-4">
                <PlatformMark provider={account.platform} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{account.displayName ?? account.handle}</p>
                  <p className="label-mono truncate">{account.handle}</p>
                </div>
                <p
                  className="font-display text-lg font-semibold tabular"
                  style={{ color: PLATFORM_ACCENT[account.platform] }}
                >
                  {account.metrics.followers === null || account.metrics.followers === undefined
                    ? "—"
                    : formatNumber(account.metrics.followers)}
                </p>
              </div>
            ))}
          </section>
        </div>
      )}
    </AppShell>
  );
}
