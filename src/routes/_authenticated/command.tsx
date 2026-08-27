import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, StatBlock } from "@/components/app-shell";
import { getWorkspace } from "@/lib/workspace.functions";
import { getIntelligence } from "@/lib/intelligence.functions";
import { providerName } from "@/lib/providers/registry";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/command")({
  head: () => ({
    meta: [
      { title: "Command center — SENTINEX" },
      {
        name: "description",
        content:
          "Live sentiment, topic momentum, anomaly detection and engagement intelligence across your connected social platform accounts.",
      },
      { property: "og:title", content: "Command center — SENTINEX" },
      {
        property: "og:description",
        content: "Evidence-backed social intelligence across official platform APIs.",
      },
    ],
  }),
  component: CommandCenter,
});

const RANGES = [
  { label: "24H", hours: 24 },
  { label: "7D", hours: 24 * 7 },
  { label: "30D", hours: 24 * 30 },
  { label: "90D", hours: 24 * 90 },
];

function nf(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function CommandCenter() {
  const [hours, setHours] = useState(24 * 7);
  const workspaceFn = useServerFn(getWorkspace);
  const intelFn = useServerFn(getIntelligence);

  const ws = useQuery({ queryKey: ["workspace"], queryFn: () => workspaceFn({}) });
  const orgId = ws.data?.workspace.id;

  const intel = useQuery({
    queryKey: ["intel", orgId, hours],
    enabled: Boolean(orgId),
    queryFn: () => intelFn({ data: { orgId: orgId!, hours } }),
  });

  const snap = intel.data;

  return (
    <AppShell workspaceName={ws.data?.workspace.name ?? "…"} email={ws.data?.email ?? null}>
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label-mono text-muted-foreground">Intelligence window</div>
            <h1 className="font-display text-xl font-semibold text-foreground">Command center</h1>
          </div>
          <div className="flex gap-1 rounded-md border border-border p-1">
            {RANGES.map((r) => (
              <button
                key={r.hours}
                onClick={() => setHours(r.hours)}
                className={cn(
                  "label-mono rounded px-3 py-1.5 transition-colors",
                  hours === r.hours
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {intel.isError ? (
          <div className="panel border-destructive/40 p-4 text-sm text-destructive">
            {(intel.error as Error).message}
          </div>
        ) : null}

        {snap && snap.totals.records === 0 ? (
          <div className="panel p-10 text-center">
            <div className="radar-sweep mx-auto mb-4 h-12 w-12 rounded-full border border-primary/40" />
            <h2 className="font-display text-lg font-semibold">No signal collected yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Connect an official platform source and run a synchronization. All intelligence on
              this screen is derived from collected records — nothing is simulated.
            </p>
            <Link
              to="/sources"
              className="label-mono mt-5 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground"
            >
              Configure sources
            </Link>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatBlock
            label="Records"
            value={nf(snap?.totals.records)}
            sub={snap ? `${snap.volumeTrend.direction} · ${snap.volumeTrend.growthPct ?? 0}%` : undefined}
            tone={snap?.volumeTrend.direction === "falling" ? "negative" : "positive"}
          />
          <StatBlock label="Engagement" value={nf(snap?.totals.engagement)} sub={`${nf(snap?.totals.comments)} comments`} />
          <StatBlock label="Views" value={nf(snap?.totals.views ?? null)} sub="provider-reported" />
          <StatBlock
            label="Sentiment"
            value={snap ? `${snap.sentiment.averageScore > 0 ? "+" : ""}${snap.sentiment.averageScore.toFixed(2)}` : "—"}
            sub={snap ? `${snap.sentiment.positive}+ / ${snap.sentiment.negative}−` : undefined}
            tone={(snap?.sentiment.averageScore ?? 0) < 0 ? "negative" : "positive"}
          />
          <StatBlock label="Anomalies" value={nf(snap?.anomalies.length)} sub="statistically flagged" tone={snap?.anomalies.length ? "negative" : "default"} />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="panel p-4 lg:col-span-2">
            <div className="label-mono mb-3 text-muted-foreground">Volume & engagement</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={snap?.series ?? []}>
                  <defs>
                    <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" width={34} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="volume" stroke="var(--color-primary)" fill="url(#vol)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel p-4">
            <div className="label-mono mb-3 text-muted-foreground">Anomaly feed</div>
            <div className="space-y-2">
              {(snap?.anomalies ?? []).slice(0, 6).map((a) => (
                <div key={a.fingerprint} className="rounded-md border border-border/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="label-mono text-primary">{a.metric}</span>
                    <span
                      className={cn(
                        "label-mono",
                        a.severity === "critical" || a.severity === "high"
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {a.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{a.headline}</p>
                  <p className="label-mono mt-1 text-muted-foreground">
                    baseline {nf(a.baseline)} → {nf(a.current)} · σ {a.deviation.toFixed(1)}
                  </p>
                </div>
              ))}
              {snap && snap.anomalies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deviations beyond baseline.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="panel p-4">
            <div className="label-mono mb-3 text-muted-foreground">Topic intelligence</div>
            <div className="space-y-2">
              {(snap?.topics ?? []).slice(0, 8).map((t) => (
                <div key={t.label} className="rounded-md border border-border/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-sm font-medium text-foreground">{t.label}</span>
                    <span className="label-mono text-primary">{t.status}</span>
                  </div>
                  <div className="label-mono mt-1 text-muted-foreground">
                    {t.volume} posts · {t.share}% share · momentum {t.trend.momentum.toFixed(2)} ·
                    sentiment {t.sentiment.averageScore.toFixed(2)}
                  </div>
                  <div className="mt-2 h-1 w-full rounded bg-secondary">
                    <div className="h-1 rounded bg-primary" style={{ width: `${Math.min(100, t.share * 2)}%` }} />
                  </div>
                </div>
              ))}
              {snap && snap.topics.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not enough text records in this window to cluster narratives.
                </p>
              ) : null}
            </div>
          </div>

          <div className="panel p-4">
            <div className="label-mono mb-3 text-muted-foreground">Top evidence</div>
            <div className="space-y-2">
              {(snap?.topPosts ?? []).slice(0, 8).map((p) => (
                <a
                  key={p.id}
                  href={p.permalink ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md border border-border/70 p-3 transition-colors hover:border-primary/50"
                >
                  <div className="label-mono flex items-center justify-between text-muted-foreground">
                    <span>{providerName(p.provider)}</span>
                    <span>{new Date(p.publishedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-foreground">{p.title ?? p.text}</p>
                  <div className="label-mono mt-1 text-muted-foreground">
                    {nf(p.views)} views · {nf(p.likes)} likes · {nf(p.commentsCount)} comments ·{" "}
                    <span className={p.sentimentScore < 0 ? "text-destructive" : "text-primary"}>
                      {p.sentimentLabel}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
