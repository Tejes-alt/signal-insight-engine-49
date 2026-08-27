import { rangeChange } from "@/lib/analytics/dashboard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowUpRight, Eye, Heart, Link2, Users } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { TrendArea, ShareDonut } from "@/components/charts";
import {
  DeltaPill,
  DemoBadge,
  EmptyState,
  MetricValue,
  SkeletonCard,
  StatCard,
  formatNumber,
} from "@/components/metrics";
import { PLATFORM_ACCENT, PlatformMark } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { useDashboard, withDashboard } from "@/hooks/use-dashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: withDashboard(DashboardPage),
  head: () => ({
    meta: [
      { title: "Overview · SocialPulse" },
      {
        name: "description",
        content:
          "Your unified social media overview: followers, reach, engagement and growth across every connected platform.",
      },
      { property: "og:title", content: "Overview · SocialPulse" },
      {
        property: "og:description",
        content: "Followers, reach and engagement across every connected platform in one dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function DashboardPage() {
  const { bundle, isLoading, demo, rangeDays } = useDashboard();

  return (
    <AppShell>
      <PageHeader
        title="Overview"
        description={`Everything across your platforms for the last ${rangeDays} days.`}
        actions={
          <>
            {bundle?.demo ? <DemoBadge /> : null}
            <Button asChild variant="outline" size="sm">
              <Link to="/accounts">
                <Link2 className="size-4" /> Connect account
              </Link>
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={1} />
          ))}
        </div>
      ) : !bundle ? (
        <EmptyState
          title="No data yet"
          body="Turn on demo mode to explore the interface, or connect a platform to load your real analytics."
          icon={<Activity className="size-5" />}
        />
      ) : bundle.platforms.length === 0 ? (
        <EmptyState
          title="No connected accounts"
          body="Connect a platform through its official authorization flow and your analytics will appear here. No passwords are ever requested or stored."
          icon={<Link2 className="size-5" />}
          action={
            <Button asChild className="mt-2">
              <Link to="/accounts">Connect your first account</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total followers"
              metric={bundle.totals.followers}
              delta={rangeChange(bundle.series, "followers")}
              icon={<Users className="size-4" />}
              accent="var(--color-chart-1)"
            />
            <StatCard
              label="Reach"
              metric={bundle.totals.reach}
              icon={<Eye className="size-4" />}
              accent="var(--color-chart-2)"
            />
            <StatCard
              label="Engagements"
              metric={bundle.totals.engagement}
              icon={<Heart className="size-4" />}
              accent="var(--color-chart-3)"
            />
            <StatCard
              label="Engagement rate"
              metric={bundle.totals.engagementRate}
              suffix="%"
              icon={<Activity className="size-4" />}
              accent="var(--color-chart-5)"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <section className="panel animate-rise p-5 xl:col-span-2">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">Audience & reach</h2>
                  <p className="text-xs text-muted-foreground">
                    Combined across {bundle.platforms.length} platform{bundle.platforms.length === 1 ? "" : "s"}
                  </p>
                </div>
                <DeltaPill value={rangeChange(bundle.series, "followers")} label="followers" />
              </div>
              <TrendArea
                series={bundle.series}
                keys={[
                  { key: "followers", label: "Followers", color: "var(--color-chart-1)" },
                  { key: "reach", label: "Reach", color: "var(--color-chart-2)" },
                ]}
              />
            </section>

            <section className="panel animate-rise p-5">
              <h2 className="font-display text-lg font-semibold">Follower mix</h2>
              <p className="mb-2 text-xs text-muted-foreground">Share of audience per platform</p>
              <ShareDonut
                data={bundle.platforms
                  .filter((p) => p.followers.value !== null)
                  .map((p) => ({
                    name: p.name,
                    value: p.followers.value ?? 0,
                    color: PLATFORM_ACCENT[p.provider],
                  }))}
              />
            </section>
          </div>

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold">Platforms</h2>
            <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bundle.platforms.map((p) => (
                <article key={p.accountId} className="panel panel-hover p-5">
                  <div className="flex items-start gap-3">
                    <PlatformMark provider={p.provider} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-display font-semibold">{p.name}</h3>
                        {p.connected ? <span className="live-dot" title="Connected" /> : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{p.handle ?? p.displayName ?? "—"}</p>
                    </div>
                    <DeltaPill value={p.growth.d30} />
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: "Followers", metric: p.followers },
                      { label: "Views", metric: p.views },
                      { label: "Engagements", metric: p.engagement },
                    ].map((row) => (
                      <div key={row.label}>
                        <dt className="label-mono">{row.label}</dt>
                        <dd className="mt-1 font-display text-lg font-semibold">
                          <MetricValue metric={row.metric} animate={false} />
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {p.extras.length > 0 ? (
                    <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
                      {p.extras.slice(0, 3).map((extra) => (
                        <li key={extra.label} className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-muted-foreground">{extra.label}</span>
                          <span className="font-semibold">
                            <MetricValue metric={extra.metric} animate={false} suffix={extra.format === "percent" ? "%" : ""} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="panel p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Top content</h2>
                <Link to="/content" className="label-mono flex items-center gap-1 hover:text-foreground">
                  View all <ArrowUpRight className="size-3" />
                </Link>
              </div>
              <ul className="divide-y divide-border">
                {bundle.content.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <PlatformMark provider={item.provider} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="label-mono">{new Date(item.publishedAt).toLocaleDateString()}</p>
                    </div>
                    <span className="tabular text-sm font-semibold">
                      {item.views.value !== null ? formatNumber(item.views.value) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Insights</h2>
                <Link to="/insights" className="label-mono flex items-center gap-1 hover:text-foreground">
                  All insights <ArrowUpRight className="size-3" />
                </Link>
              </div>
              <ul className="space-y-3">
                {bundle.insights.slice(0, 3).map((insight) => (
                  <li key={insight.id} className="rounded-xl border border-border bg-secondary/40 p-3">
                    <p className="text-sm font-semibold">{insight.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {demo ? (
            <p className="text-center text-xs text-muted-foreground">
              Demo mode is on — every figure above is generated sample data, not real account analytics.
            </p>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
