import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { DemoBadge, EmptyState, SkeletonCard } from "@/components/metrics";
import { useDashboard } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";
import type { InsightTone } from "@/lib/analytics/dashboard";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
  head: () => ({
    meta: [
      { title: "Insights · Pulse Social Analytics" },
      {
        name: "description",
        content: "Evidence-backed observations about your posting cadence, growth and best-performing content.",
      },
      { property: "og:title", content: "Insights · Pulse Social Analytics" },
      {
        property: "og:description",
        content: "Every observation states the data it was derived from — no invented numbers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const TONE: Record<InsightTone, { icon: typeof Info; className: string; accent: string }> = {
  positive: { icon: CheckCircle2, className: "text-success", accent: "var(--color-success)" },
  neutral: { icon: Info, className: "text-primary", accent: "var(--color-primary)" },
  warning: { icon: AlertTriangle, className: "text-warning", accent: "var(--color-warning)" },
};

function InsightsPage() {
  const { bundle, isLoading } = useDashboard();

  return (
    <AppShell>
      <PageHeader
        title="Insights"
        description="Observations derived from your own numbers — each one shows its evidence."
        actions={bundle?.demo ? <DemoBadge /> : null}
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={3} />
          ))}
        </div>
      ) : !bundle || bundle.insights.length === 0 ? (
        <EmptyState
          title="No insights yet"
          body="Insights appear once there's enough history to compare. Connect a platform or enable demo mode."
          icon={<Sparkles className="size-5" />}
        />
      ) : (
        <div className="stagger grid gap-4 lg:grid-cols-2">
          {bundle.insights.map((insight) => {
            const tone = TONE[insight.tone];
            const Icon = tone.icon;
            return (
              <article key={insight.id} className="panel panel-hover relative overflow-hidden p-5">
                <span className="absolute inset-x-0 top-0 h-px" style={{ background: tone.accent, opacity: 0.6 }} />
                <div className="flex items-start gap-3">
                  <span
                    className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-secondary/70", tone.className)}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <h2 className="font-display text-base font-semibold">{insight.title}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{insight.body}</p>
                    <p className="label-mono mt-3 border-t border-border pt-3">Evidence</p>
                    <p className="mt-1 text-xs text-muted-foreground">{insight.evidence}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
