import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Play } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { DemoBadge, EmptyState, MetricValue, SkeletonCard } from "@/components/metrics";
import { PlatformMark } from "@/components/platform";
import { useDashboard, withDashboard } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";
import type { ProviderId } from "@/lib/providers/registry";

export const Route = createFileRoute("/_authenticated/content")({
  component: withDashboard(ContentPage),
  head: () => ({
    meta: [
      { title: "Content · SocialPulse" },
      {
        name: "description",
        content: "See which posts, videos and reels performed best across all of your social platforms.",
      },
      { property: "og:title", content: "Content · SocialPulse" },
      {
        property: "og:description",
        content: "Rank every post, video and reel by views, engagement and engagement rate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type SortKey = "views" | "engagementRate" | "publishedAt";

function ContentPage() {
  const { bundle, isLoading } = useDashboard();
  const [platform, setPlatform] = useState<ProviderId | "all">("all");
  const [sort, setSort] = useState<SortKey>("views");

  const items = useMemo(() => {
    const list = (bundle?.content ?? []).filter((c) => platform === "all" || c.provider === platform);
    return [...list].sort((a, b) => {
      if (sort === "publishedAt") return b.publishedAt.localeCompare(a.publishedAt);
      return (b[sort].value ?? -1) - (a[sort].value ?? -1);
    });
  }, [bundle, platform, sort]);

  const platforms = bundle?.platforms ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Content"
        description="Every post ranked by how it actually performed."
        actions={bundle?.demo ? <DemoBadge /> : null}
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No content in this range"
          body="Once a connected platform reports posts in the selected period, they'll be ranked here."
          icon={<Play className="size-5" />}
        />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-secondary/50 p-1">
              <FilterChip active={platform === "all"} onClick={() => setPlatform("all")}>
                All
              </FilterChip>
              {platforms.map((p) => (
                <FilterChip key={p.accountId} active={platform === p.provider} onClick={() => setPlatform(p.provider)}>
                  {p.name}
                </FilterChip>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1 rounded-xl border border-border bg-secondary/50 p-1">
              {(
                [
                  ["views", "Views"],
                  ["engagementRate", "Eng. rate"],
                  ["publishedAt", "Newest"],
                ] as Array<[SortKey, string]>
              ).map(([key, label]) => (
                <FilterChip key={key} active={sort === key} onClick={() => setSort(key)}>
                  {label}
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article key={item.id} className="panel panel-hover group overflow-hidden">
                <div className="relative aspect-video overflow-hidden bg-secondary/60">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid size-full place-items-center">
                      <PlatformMark provider={item.provider} size="lg" />
                    </div>
                  )}
                  <span className="absolute left-3 top-3">
                    <PlatformMark provider={item.provider} size="sm" />
                  </span>
                  {item.permalink ? (
                    <a
                      href={item.permalink}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="absolute right-3 top-3 grid size-7 place-items-center rounded-lg bg-background/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                      aria-label="Open original post"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                </div>
                <div className="p-4">
                  <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
                  <p className="label-mono mt-1">{new Date(item.publishedAt).toLocaleDateString()}</p>
                  <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3">
                    {[
                      ["Views", item.views],
                      ["Likes", item.likes],
                      ["Comments", item.comments],
                      ["Shares", item.shares],
                    ].map(([label, metric]) => (
                      <div key={label as string}>
                        <dt className="label-mono text-[0.6rem]">{label as string}</dt>
                        <dd className="mt-0.5 text-sm font-semibold">
                          <MetricValue metric={metric as never} animate={false} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200",
        active
          ? "bg-background text-foreground shadow-[var(--shadow-soft)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
