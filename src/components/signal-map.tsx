import { useMemo } from "react";
import { PLATFORM_ACCENT, platformName } from "@/components/platform";
import { SocialPulseMark } from "@/components/brand";
import { formatNumber } from "@/components/metrics";
import { cn } from "@/lib/utils";
import type { PlatformId, PublicAccountView } from "@/lib/public/types";

/**
 * SOCIAL SIGNAL MAP
 * =================
 * Not planets around a sun. Each tracked presence is a signal source; its
 * distance from the aggregation point is inverse to its signal strength (share
 * of total audience), so the map is readable as data, not decoration. Flow
 * direction is inward: everything resolves into the SocialPulse mark.
 *
 * Selecting a node dims the rest of the map and, via the caller, the rest of
 * the page.
 */
export function SignalMap({
  accounts,
  selected,
  onSelect,
}: {
  accounts: PublicAccountView[];
  selected: PlatformId | null;
  onSelect: (platform: PlatformId | null) => void;
}) {
  const nodes = useMemo(() => {
    const total = accounts.reduce((sum, a) => sum + (a.metrics.followers ?? 0), 0);
    const count = accounts.length;
    return accounts.map((account, i) => {
      const share = total > 0 ? (account.metrics.followers ?? 0) / total : 1 / Math.max(1, count);
      // Strong signals sit close to the aggregation point.
      const radius = 42 - Math.min(0.85, share) * 18;
      const angle = (i / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2 + (i % 2 ? 0.14 : -0.14);
      return {
        account,
        share,
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius * 0.78,
      };
    });
  }, [accounts]);

  if (nodes.length === 0) return null;

  return (
    <div className="relative h-[21rem] w-full select-none" onMouseLeave={() => onSelect(null)}>
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {nodes.map(({ account, x, y, share }) => {
          const active = selected === account.platform;
          const dim = selected !== null && !active;
          return (
            <g key={account.id} opacity={dim ? 0.18 : 1} style={{ transition: "opacity 200ms var(--ease-out-soft)" }}>
              <line
                x1={x}
                y1={y}
                x2="50"
                y2="50"
                stroke={active ? PLATFORM_ACCENT[account.platform] : "var(--color-border-strong)"}
                strokeWidth={active ? 0.55 : 0.22 + share * 0.5}
                vectorEffect="non-scaling-stroke"
                className="flow-line"
                style={{ animationDuration: `${2.4 - share * 0.9}s` }}
              />
            </g>
          );
        })}
      </svg>

      {/* Aggregation point */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="grid size-[4.5rem] place-items-center rounded-full border border-border bg-background">
          <SocialPulseMark size={30} className="text-primary" />
        </div>
        <p className="label-faint mt-2 text-center">Aggregate</p>
      </div>

      {nodes.map(({ account, x, y, share }) => {
        const active = selected === account.platform;
        const dim = selected !== null && !active;
        const accent = PLATFORM_ACCENT[account.platform];
        // Selecting a node pulls it fractionally inward; the field reorganises.
        const pull = active ? 0.92 : dim ? 1.04 : 1;
        return (
          <button
            key={account.id}
            onMouseEnter={() => onSelect(account.platform)}
            onFocus={() => onSelect(account.platform)}
            onClick={() => onSelect(active ? null : account.platform)}
            aria-label={`${platformName(account.platform)} — ${account.handle}`}
            aria-pressed={active}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background/90 px-2.5 py-2 text-left backdrop-blur-sm",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              active ? "border-border-strong" : "border-border",
            )}
            style={{
              left: `${50 + (x - 50) * pull}%`,
              top: `${50 + (y - 50) * pull}%`,
              opacity: dim ? 0.35 : 1,
              transition: "left 260ms var(--ease-out-soft), top 260ms var(--ease-out-soft), opacity 200ms linear",
            }}
          >
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full" style={{ background: accent }} />
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
                {platformName(account.platform)}
              </span>
            </span>
            <span className="mt-1 block figure text-sm">
              {account.metrics.followers === null || account.metrics.followers === undefined
                ? "—"
                : formatNumber(account.metrics.followers)}
            </span>
            {/* Signal strength: share of total audience, five discrete steps. */}
            <span className="mt-1.5 flex gap-[3px]" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className="h-2 w-[3px] rounded-[1px]"
                  style={{
                    background: i < Math.max(1, Math.round(share * 5)) ? accent : "var(--color-border-strong)",
                    opacity: i < Math.max(1, Math.round(share * 5)) ? 1 : 0.6,
                  }}
                />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
