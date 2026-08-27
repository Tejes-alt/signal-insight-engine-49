import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * THE SOCIALPULSE MARK
 * ====================
 * Three arc segments of increasing radius, each stepping 120° around a common
 * centre, terminating in a solid node. Read outward it is a signal radiating
 * from a single source; read inward it is many separate presences converging
 * into one point of aggregation. The stagger between the arcs gives it
 * rotation — movement — without ever spinning.
 *
 * It is not a heartbeat, not a star, not a network diagram and not a letter.
 * Geometry: 32-unit square, centre 16,16, radii 4.6 / 9.0 / 13.4, stroke 2.4
 * with round caps, so the silhouette survives down to 16px.
 */

const ARCS = [
  { d: "M 15.20 11.47 A 4.6 4.6 0 0 1 20.32 17.57", w: 2.6, o: 1 },
  { d: "M 24.46 19.08 A 9.0 9.0 0 0 1 9.11 21.79", w: 2.4, o: 0.72 },
  { d: "M 5.74 24.61 A 13.4 13.4 0 0 1 13.67 2.80", w: 2.2, o: 0.44 },
] as const;

export function SocialPulseMark({
  size = 28,
  className,
  /** Play the convergence animation once on mount. Reserved for load, sign-in and milestones. */
  animate = false,
  title,
}: {
  size?: number;
  className?: string;
  animate?: boolean;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0 overflow-visible", className)}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
    >
      {ARCS.map((arc, i) => (
        <path
          key={arc.d}
          d={arc.d}
          pathLength={100}
          stroke="currentColor"
          strokeWidth={arc.w}
          strokeLinecap="round"
          opacity={arc.o}
          style={
            animate
              ? {
                  strokeDasharray: 100,
                  strokeDashoffset: 100,
                  animation: `trace 520ms var(--ease-signal) ${140 - i * 60}ms both`,
                }
              : undefined
          }
        />
      ))}
      <circle
        cx="16"
        cy="16"
        r="2.5"
        fill="currentColor"
        style={
          animate
            ? { transformOrigin: "16px 16px", animation: "value-shift 380ms var(--ease-spring) 360ms both" }
            : undefined
        }
      />
      {animate ? (
        <circle
          cx="16"
          cy="16"
          r="4"
          stroke="currentColor"
          strokeWidth="1.4"
          opacity="0"
          style={{ transformOrigin: "16px 16px", animation: "emit 900ms var(--ease-out-soft) 520ms 1 both" }}
        />
      ) : null}
    </svg>
  );
}

/**
 * The lockup. SOCIALPULSE is one word: "SOCIAL" recedes into the interface,
 * "PULSE" carries the weight, and a hairline rule ties the mark to the word so
 * the two read as a single object rather than an icon beside a label.
 */
export function SocialPulseLogo({
  compact = false,
  animate = false,
  size = 26,
  className,
}: {
  compact?: boolean;
  animate?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <SocialPulseMark size={size} animate={animate} className="text-primary" title="SocialPulse" />
      {!compact ? (
        <>
          <span className="h-5 w-px bg-border" aria-hidden />
          <span className="font-display text-[0.95rem] leading-none tracking-[0.02em]">
            <span className="font-normal text-muted-foreground">SOCIAL</span>
            <span className="font-bold text-foreground">PULSE</span>
          </span>
        </>
      ) : null}
    </span>
  );
}

/**
 * Full-screen brand moment: the mark converges, pulses once, and hands over.
 * Used for the initial app load only — never as an idle loop.
 */
export function BrandSplash({ onDone }: { onDone?: () => void }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGone(true);
      onDone?.();
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  if (gone) return null;
  return (
    <div
      className="animate-fade pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-background"
      style={{ animation: "fade-in 160ms both, fade-in 240ms 860ms reverse both" }}
    >
      <SocialPulseMark size={64} animate className="text-primary" />
    </div>
  );
}

/** Watermark for empty states and report headers. Quiet, structural. */
export function MarkWatermark({ className }: { className?: string }) {
  return (
    <SocialPulseMark size={168} className={cn("pointer-events-none text-primary opacity-[0.06]", className)} />
  );
}
