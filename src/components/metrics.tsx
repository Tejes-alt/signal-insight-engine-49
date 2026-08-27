import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info, TrendingDown, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Metric } from "@/lib/analytics/dashboard";

/** Compact human formatting: 1_284_000 -> 1.28M */
export function formatNumber(value: number, precision = 1): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(precision)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(precision)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(precision)}K`;
  return Math.round(value).toLocaleString();
}

export function formatFull(value: number): string {
  return Math.round(value).toLocaleString();
}

/**
 * Counts up to the target once the element enters the viewport.
 * Motion communicates "this number just loaded", not decoration — it runs once
 * per value change and respects reduced-motion via the CSS media query below.
 */
export function AnimatedNumber({
  value,
  format = formatNumber,
  duration = 900,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    started.current = false;
    const node = ref.current;
    if (!node) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }

    const run = () => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const from = 0;
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(from + (value - from) * eased);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && run()),
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {format(display)}
    </span>
  );
}

export function Unavailable({ note }: { note?: string | undefined }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help items-center gap-1.5 text-sm font-medium text-muted-foreground">
          Not available
          <Info className="size-3.5 opacity-70" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {note ?? "This platform's API does not expose this metric."}
      </TooltipContent>
    </Tooltip>
  );
}

export function MetricValue({
  metric,
  suffix,
  animate = true,
  className,
}: {
  metric: Metric;
  suffix?: string | undefined;
  animate?: boolean;
  className?: string;
}) {
  if (metric.state === "unavailable" || metric.value === null) return <Unavailable note={metric.note} />;
  return (
    <span className={className}>
      {animate ? <AnimatedNumber value={metric.value} /> : formatNumber(metric.value)}
      {suffix}
    </span>
  );
}

export function DeltaPill({ value, label }: { value: number | null; label?: string }) {
  if (value === null) {
    return <span className="label-mono">no history yet</span>;
  }
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular",
        positive
          ? "bg-success/12 text-success"
          : "bg-destructive/12 text-destructive",
      )}
    >
      {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {positive ? "+" : ""}
      {value.toFixed(1)}%{label ? <span className="font-normal opacity-70"> {label}</span> : null}
    </span>
  );
}

export function StatCard({
  label,
  metric,
  delta,
  suffix,
  icon,
  accent,
  footer,
}: {
  label: string;
  metric: Metric;
  delta?: number | null;
  suffix?: string;
  icon?: ReactNode;
  accent?: string;
  footer?: ReactNode;
}) {
  return (
    <div className="panel panel-hover group relative overflow-hidden p-5">
      <div
        className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-45"
        style={{ background: accent ?? "var(--color-primary)" }}
      />
      <div className="flex items-start justify-between gap-3">
        <span className="label-mono">{label}</span>
        {icon ? (
          <span className="grid size-8 place-items-center rounded-lg bg-secondary/70 text-muted-foreground transition-colors group-hover:text-foreground">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tracking-tight">
        <MetricValue metric={metric} suffix={suffix} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        {delta !== undefined ? <DeltaPill value={delta} label="30d" /> : null}
        {footer}
      </div>
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="panel p-5">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-4 h-8 w-32" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="skeleton h-3" style={{ width: `${90 - i * 18}%` }} />
        ))}
      </div>
    </div>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "label-mono inline-flex cursor-help items-center gap-1.5 rounded-full border border-warning/40 bg-warning/12 px-2.5 py-1 text-warning",
            className,
          )}
        >
          <span className="size-1.5 rounded-full bg-warning" />
          Demo data
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Realistic sample figures for evaluating the interface. Nothing here comes from a real account —
        connect a platform to replace it with live data.
      </TooltipContent>
    </Tooltip>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon ? (
        <span className="grid size-12 place-items-center rounded-2xl bg-secondary/70 text-muted-foreground">
          {icon}
        </span>
      ) : null}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}
