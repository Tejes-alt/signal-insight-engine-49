import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BalanceRadar, CompareBars, TrendArea, TrendLines } from "@/components/charts";
import { DeltaPill, DemoBadge, EmptyState, MetricValue, SkeletonCard } from "@/components/metrics";
import { PLATFORM_ACCENT, PlatformMark } from "@/components/platform";
import { useDashboard } from "@/hooks/dashboard-context";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
  head: () => ({
    meta: [
      { title: "Analytics · SocialPulse" },
      {
        name: "description",
        content: "Deep-dive charts comparing growth, reach and engagement across your social platforms.",
      },
      { property: "og:title", content: "Analytics · SocialPulse" },
      {
        property: "og:description",
        content: "Compare growth, reach and engagement across every platform you publish on.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AnalyticsPage() {
  const { bundle, isLoading, rangeDays } = useDashboard();

  const growthRows = bundle
    ? [
        { key: "d7", label: "7 days" },
        { key: "d30", label: "30 days" },
        { key: "d90", label: "90 days" },
        { key: "y1", label: "1 year" },
      ]
    : [];

  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        description={`Cross-platform performance for the last ${rangeDays} days.`}
        actions={bundle?.demo ? <DemoBadge /> : null}
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={4} />
          ))}
        </div>
      ) : !bundle || bundle.platforms.length === 0 ? (
        <EmptyState
          title="Nothing to chart yet"
          body="Connect a platform or switch on demo mode to see the full analytics surface."
          icon={<BarChart3 className="size-5" />}
        />
      ) : (
        <div className="space-y-6">
          <section className="panel animate-rise p-5">
            <h2 className="font-display text-lg font-semibold">Views, engagement & reach</h2>
            <p className="mb-3 text-xs text-muted-foreground">Daily totals across all platforms</p>
            <TrendArea
              series={bundle.series}
              height={340}
              keys={[
                { key: "views", label: "Views", color: "var(--color-chart-2)" },
                { key: "engagement", label: "Engagement", color: "var(--color-chart-3)" },
                { key: "reach", label: "Reach", color: "var(--color-chart-1)" },
              ]}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="panel animate-rise p-5">
              <h2 className="font-display text-lg font-semibold">Follower growth by platform</h2>
              <p className="mb-3 text-xs text-muted-foreground">Indexed daily follower counts</p>
              <TrendLines
                height={320}
                series={mergeByDate(bundle.platforms)}
                keys={bundle.platforms.map((p) => ({
                  key: p.accountId,
                  label: p.name,
                  color: PLATFORM_ACCENT[p.provider],
                }))}
              />
            </section>

            <section className="panel animate-rise p-5">
              <h2 className="font-display text-lg font-semibold">Engagement by platform</h2>
              <p className="mb-3 text-xs text-muted-foreground">Total interactions in the selected range</p>
              <CompareBars
                height={320}
                data={bundle.platforms
                  .filter((p) => p.engagement.value !== null)
                  .map((p) => ({
                    name: p.name,
                    value: p.engagement.value ?? 0,
                    color: PLATFORM_ACCENT[p.provider],
                  }))}
              />
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="panel animate-rise p-5 lg:col-span-2">
              <h2 className="font-display text-lg font-semibold">Growth windows</h2>
              <p className="mb-3 text-xs text-muted-foreground">Follower change per platform over time</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 text-left"><span className="label-mono">Platform</span></th>
                      {growthRows.map((g) => (
                        <th key={g.key} className="py-2 text-right"><span className="label-mono">{g.label}</span></th>
                      ))}
                      <th className="py-2 text-right"><span className="label-mono">Followers</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.platforms.map((p) => (
                      <tr key={p.accountId} className="border-b border-border/60 last:border-0">
                        <td className="py-3">
                          <span className="flex items-center gap-2">
                            <PlatformMark provider={p.provider} size="sm" />
                            <span className="font-medium">{p.name}</span>
                          </span>
                        </td>
                        {growthRows.map((g) => (
                          <td key={g.key} className="py-3 text-right">
                            <DeltaPill value={p.growth[g.key as keyof typeof p.growth]} />
                          </td>
                        ))}
                        <td className="tabular py-3 text-right font-semibold">
                          <MetricValue metric={p.followers} animate={false} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel animate-rise p-5">
              <h2 className="font-display text-lg font-semibold">Platform balance</h2>
              <p className="mb-3 text-xs text-muted-foreground">Relative share of your total audience</p>
              <BalanceRadar
                data={bundle.platforms.map((p) => ({
                  axis: p.name,
                  value: Math.round(
                    ((p.followers.value ?? 0) / Math.max(bundle.totals.followers.value ?? 1, 1)) * 100,
                  ),
                }))}
              />
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}

/** Pivot per-platform series into one row per date keyed by account id. */
function mergeByDate(platforms: ReturnType<typeof usePlatforms>) {
  const rows = new Map<string, Record<string, unknown>>();
  for (const p of platforms) {
    for (const point of p.series) {
      const row = rows.get(point.date) ?? { date: point.date };
      row[p.accountId] = point.followers;
      rows.set(point.date, row);
    }
  }
  return Array.from(rows.values()).sort((a, b) => String(a['date']).localeCompare(String(b['date'])));
}

// Type helper only — never called.
declare function usePlatforms(): NonNullable<ReturnType<typeof useDashboard>["bundle"]>["platforms"];
