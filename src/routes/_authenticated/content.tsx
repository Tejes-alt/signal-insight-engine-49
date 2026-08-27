import { createFileRoute } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { EmptyState, SkeletonCard, formatNumber } from "@/components/metrics";
import { PlatformMark, platformName } from "@/components/platform";
import { useDashboard } from "@/hooks/dashboard-context";

export const Route = createFileRoute("/_authenticated/content")({
  component: ContentPage,
  head: () => ({
    meta: [
      { title: "Content · SocialPulse" },
      {
        name: "description",
        content: "Your recent public posts and videos with the view, like and comment counts each platform publishes.",
      },
      { property: "og:title", content: "Content · SocialPulse" },
      { property: "og:description", content: "Recent public content across every handle you track." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ContentPage() {
  const { accounts, isLoading } = useDashboard();
  const items = accounts
    .flatMap((a) => a.content)
    .sort((a, b) => Date.parse(b.publishedAt ?? "0") - Date.parse(a.publishedAt ?? "0"));

  return (
    <AppShell>
      <PageHeader
        title="Content"
        description="Recent public posts, with only the counts each platform actually publishes."
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No public content retrieved"
          body="Add a handle on the Accounts page. If a platform doesn't publish content details openly, nothing is shown here rather than invented."
          icon={<Play className="size-5" />}
        />
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <a
              key={`${item.platform}-${item.externalId}`}
              href={item.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="panel panel-hover group flex flex-col overflow-hidden"
            >
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.title ?? "Post thumbnail"}
                  loading="lazy"
                  className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : null}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-center gap-2">
                  <PlatformMark provider={item.platform} size="sm" />
                  <span className="label-mono truncate">{item.accountHandle}</span>
                </div>
                <p className="line-clamp-2 text-sm font-medium">{item.title ?? platformName(item.platform)}</p>
                <div className="mt-auto flex flex-wrap gap-3 border-t border-border pt-2 text-xs text-muted-foreground tabular">
                  {item.views !== null && item.views !== undefined ? <span>{formatNumber(item.views)} views</span> : null}
                  {item.likes !== null && item.likes !== undefined ? <span>{formatNumber(item.likes)} likes</span> : null}
                  {item.comments !== null && item.comments !== undefined ? (
                    <span>{formatNumber(item.comments)} comments</span>
                  ) : null}
                  {item.publishedAt ? <span>{new Date(item.publishedAt).toLocaleDateString()}</span> : null}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </AppShell>
  );
}
