import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { SimpleArea } from "@/components/public-charts";
import { EmptyState, SkeletonCard, formatNumber } from "@/components/metrics";
import { PLATFORM_ACCENT, PlatformMark, platformName } from "@/components/platform";
import { useDashboard } from "@/hooks/dashboard-context";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
  head: () => ({
    meta: [
      { title: "Analytics · SocialPulse" },
      {
        name: "description",
        content:
          "Per-platform breakdown of followers, engagement rate, averages and posting cadence from real retrieved data.",
      },
      { property: "og:title", content: "Analytics · SocialPulse" },
      { property: "og:description", content: "Compare only what is genuinely comparable across your platforms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function cell(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined) {
    return <span className="text-xs text-muted-foreground">Requires account connection</span>;
  }
  return (
    <span className="tabular font-semibold">
      {suffix === "%" ? value.toFixed(1) : formatNumber(value)}
      {suffix}
    </span>
  );
}

function AnalyticsPage() {
  const { accounts, isLoading } = useDashboard();

  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        description="Averages and growth computed from the snapshots SocialPulse has actually stored."
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonCard key={i} lines={4} />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          title="Nothing to analyze yet"
          body="Add a handle on the Accounts page and analytics will build up from each check."
          icon={<BarChart3 className="size-5" />}
        />
      ) : (
        <div className="space-y-6">
          <section className="panel overflow-x-auto p-0">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Platform", "Followers", "Engagement", "Avg likes", "Avg comments", "Avg views", "Posts / week"].map(
                    (h) => (
                      <th key={h} className="label-mono px-4 py-3">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <PlatformMark provider={a.platform} size="sm" />
                        <span>
                          <span className="block font-medium">{platformName(a.platform)}</span>
                          <span className="label-mono">{a.handle}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">{cell(a.metrics.followers)}</td>
                    <td className="px-4 py-3">{cell(a.engagementRate, "%")}</td>
                    <td className="px-4 py-3">{cell(a.avgLikes)}</td>
                    <td className="px-4 py-3">{cell(a.avgComments)}</td>
                    <td className="px-4 py-3">{cell(a.avgViews)}</td>
                    <td className="px-4 py-3">{cell(a.postsPerWeek)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            {accounts.map((a) => (
              <section key={a.id} className="panel p-5">
                <div className="flex items-center gap-3">
                  <PlatformMark provider={a.platform} />
                  <div>
                    <h2 className="font-display text-base font-semibold">{platformName(a.platform)}</h2>
                    <p className="label-mono">{a.handle}</p>
                  </div>
                </div>
                {a.history.length > 1 ? (
                  <div className="mt-4">
                    <SimpleArea
                      data={a.history
                        .filter((h) => h.followers !== null)
                        .map((h) => ({ date: h.capturedAt, followers: h.followers as number }))}
                      xKey="date"
                      yKey="followers"
                      label="Followers"
                      color={PLATFORM_ACCENT[a.platform]}
                      height={220}
                    />
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-muted-foreground">{a.growth.note}</p>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
