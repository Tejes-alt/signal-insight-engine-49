import { useState } from "react";
import { PLATFORM_ACCENT, PlatformMark, platformName } from "@/components/platform";
import { formatNumber } from "@/components/metrics";
import { cn } from "@/lib/utils";
import type { PublicAccountView } from "@/lib/public/types";

/**
 * The user's social ecosystem: each tracked platform is a node linked to the
 * centre. Everything shown on hover comes from real retrieved data.
 */
export function PlatformOrbit({ accounts }: { accounts: PublicAccountView[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const n = accounts.length;
  if (n === 0) return null;

  const radius = 38; // percentage of container
  const nodes = accounts.map((account, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      account,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius * 0.86,
    };
  });

  const active = nodes.find((node) => node.account.id === hover)?.account ?? null;

  return (
    <div className="relative h-[22rem] w-full">
      <svg className="absolute inset-0 size-full" aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none">
        {nodes.map((node) => (
          <line
            key={node.account.id}
            x1="50"
            y1="50"
            x2={node.x}
            y2={node.y}
            stroke={hover === node.account.id ? PLATFORM_ACCENT[node.account.platform] : "var(--color-border-strong)"}
            strokeWidth={hover === node.account.id ? 0.5 : 0.25}
            className="flow-line transition-all duration-300"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/25 halo-ring"
          aria-hidden
        />
        <div className="relative grid size-24 place-items-center rounded-full border border-border bg-background/60 backdrop-blur-sm">
          <p className="font-display text-lg font-semibold tabular">{n}</p>
          <p className="label-mono text-[0.6rem]">{n === 1 ? "platform" : "platforms"}</p>
        </div>
      </div>

      {nodes.map((node) => {
        const { account } = node;
        const isActive = hover === account.id;
        return (
          <button
            key={account.id}
            onMouseEnter={() => setHover(account.id)}
            onFocus={() => setHover(account.id)}
            onMouseLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            aria-label={`${platformName(account.platform)} — ${account.handle}`}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface/70 p-2 backdrop-blur-sm transition-all duration-300",
              isActive ? "scale-110 border-border-strong shadow-[var(--shadow-raised)]" : "hover:scale-105",
            )}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <PlatformMark provider={account.platform} />
          </button>
        );
      })}

      <div className="absolute inset-x-0 bottom-0">
        {active ? (
          <div className="animate-fade glass rounded-xl px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <span className="font-display text-sm font-semibold">{platformName(active.platform)}</span>
              <span className="label-mono">{active.handle}</span>
              <Fact label="Followers" value={active.metrics.followers ?? null} />
              <Fact label="Content" value={active.metrics.posts ?? active.content.length} />
              <Fact
                label="Engagement"
                value={active.engagementRate}
                format={(v) => `${v.toFixed(2)}%`}
              />
            </div>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Hover a platform to see its numbers.</p>
        )}
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  format = formatNumber,
}: {
  label: string;
  value: number | null;
  format?: (v: number) => string;
}) {
  return (
    <span className="text-xs">
      <span className="text-muted-foreground">{label} </span>
      <span className="font-semibold tabular">{value === null ? "—" : format(value)}</span>
    </span>
  );
}
