import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Info, Sparkles } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { EmptyState, SkeletonCard } from "@/components/metrics";
import { useDashboard } from "@/hooks/dashboard-context";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/public/types";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
  head: () => ({
    meta: [
      { title: "Insights · SocialPulse" },
      {
        name: "description",
        content: "Observations calculated from the public data SocialPulse actually retrieved — never invented.",
      },
      { property: "og:title", content: "Insights · SocialPulse" },
      { property: "og:description", content: "Every observation is backed by data retrieved from your profiles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const TONE: Record<Insight["tone"], { icon: typeof Info; className: string; accent: string }> = {
  positive: { icon: CheckCircle2, className: "text-success", accent: "var(--color-success)" },
  neutral: { icon: Info, className: "text-primary", accent: "var(--color-primary)" },
  info: { icon: Sparkles, className: "text-warning", accent: "var(--color-warning)" },
};

function InsightsPage() {
  const { overview, isLoading } = useDashboard();
  const insights = overview?.insights ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Insights"
        description="Calculated only from information your profiles publish openly."
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
      ) : insights.length === 0 ? (
        <EmptyState
          title="No insights yet"
          body="Add a handle on the Accounts page — insights appear as soon as public information is retrieved."
          icon={<Sparkles className="size-5" />}
        />
      ) : (
        <div className="stagger grid gap-4 lg:grid-cols-2">
          {insights.map((insight) => {
            const tone = TONE[insight.tone];
            const Icon = tone.icon;
            return (
              <article key={insight.id} className="panel panel-hover relative overflow-hidden p-5">
                <span className="absolute inset-x-0 top-0 h-px" style={{ background: tone.accent, opacity: 0.6 }} />
                <div className="flex items-start gap-3">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-secondary/70", tone.className)}>
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <h2 className="font-display text-base font-semibold">{insight.title}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{insight.detail}</p>
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
