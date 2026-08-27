import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyField } from "@/components/signal";
import { cn } from "@/lib/utils";

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
 * NUMBER BEHAVIOUR
 * ================
 * A real analytics product does not count every value up from zero every time
 * you open it. So:
 *   - First appearance: the value is simply revealed (no counting).
 *   - Value changes while on screen: only the delta is travelled, quickly, and
 *     the digits that changed are highlighted as they settle.
 */
export function AnimatedNumber({
  value,
  format = formatNumber,
  duration = 520,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const [shifted, setShifted] = useState(false);
  const previous = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (from === value) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }

    setShifted(true);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else window.setTimeout(() => setShifted(false), 260);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return (
    <span className={cn("tabular transition-colors duration-300", shifted && "text-primary", className)}>
      {format(display)}
    </span>
  );
}

/** The dominant reading on a screen. One per section, at most. */
export function Figure({
  value,
  suffix,
  format = formatNumber,
  className,
}: {
  value: number | null;
  suffix?: string;
  format?: (n: number) => string;
  className?: string;
}) {
  if (value === null) {
    return <span className="text-base font-normal text-faint">Not recorded yet</span>;
  }
  return (
    <span className={cn("figure", className)}>
      <AnimatedNumber value={value} format={format} />
      {suffix ? <span className="ml-0.5 text-[0.5em] font-medium text-muted-foreground">{suffix}</span> : null}
    </span>
  );
}

export function Unavailable({ note }: { note?: string | undefined }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help items-center gap-1.5 text-sm font-medium text-faint">
          Not available
          <Info className="size-3.5 opacity-70" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {note ?? "This platform does not publish this metric openly."}
      </TooltipContent>
    </Tooltip>
  );
}

/** Change indicator. Direction is carried by a tick, not by a coloured pill. */
export function DeltaPill({ value, label }: { value: number | null; label?: string }) {
  if (value === null) {
    return <span className="label-faint">no history yet</span>;
  }
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 font-mono text-xs font-medium tabular",
        positive ? "text-primary" : "text-destructive",
      )}
    >
      <span aria-hidden className="text-[0.9em]">
        {positive ? "▲" : "▼"}
      </span>
      {positive ? "+" : ""}
      {value.toFixed(1)}%{label ? <span className="text-faint"> {label}</span> : null}
    </span>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="border-t border-border py-5">
      <div className="skeleton h-2.5 w-20" />
      <div className="skeleton mt-4 h-7 w-28" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="skeleton h-2" style={{ width: `${80 - i * 18}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Kept for compatibility — routes to the SocialPulse empty field. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return <EmptyField title={title} body={body} action={action} />;
}
