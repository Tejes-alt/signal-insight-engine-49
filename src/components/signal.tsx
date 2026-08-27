import { useEffect, useRef, useState, type ReactNode } from "react";
import { SocialPulseMark } from "@/components/brand";
import { cn } from "@/lib/utils";

/**
 * SIGNAL PRIMITIVES
 * =================
 * SocialPulse's visualisation vocabulary. Everything here is drawn from the
 * same idea: measurement is a signal travelling along a path. These components
 * replace generic spinners, progress bars and "no data" illustrations.
 */

/** A single signal travelling a data path. Shown only while work is real. */
export function SignalScan({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)} role="status" aria-live="polite">
      <svg viewBox="0 0 120 16" className="h-4 w-[120px] text-primary" fill="none" aria-hidden>
        <path d="M0 8h34l6-5 7 10 6-9 5 4h56" stroke="currentColor" strokeWidth="1.2" opacity="0.22" />
        <path
          d="M0 8h34l6-5 7 10 6-9 5 4h56"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray="26 200"
          style={{ animation: "dash-flow 1.6s linear infinite" }}
        />
      </svg>
      {label ? <span className="label-mono">{label}</span> : null}
    </div>
  );
}

/**
 * The empty-history visualisation: a solid segment for what has been recorded,
 * dissolving into a dotted future. Communicates "history begins now" instead of
 * apologising for missing data.
 */
export function SignalHorizon({
  title = "Your history starts here",
  body,
  action,
}: {
  title?: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden py-10">
      <svg viewBox="0 0 400 80" preserveAspectRatio="none" className="h-20 w-full text-primary" fill="none" aria-hidden>
        <defs>
          <linearGradient id="sp-horizon" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="22%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 62 L88 62" stroke="url(#sp-horizon)" strokeWidth="1.8" />
        <path d="M88 62 L400 40" stroke="url(#sp-horizon)" strokeWidth="1.4" strokeDasharray="2 7" />
        <circle cx="88" cy="62" r="3.2" fill="currentColor" />
        <circle cx="88" cy="62" r="7" stroke="currentColor" strokeWidth="1" opacity="0.4" className="halo-ring" />
      </svg>
      <div className="mt-4 max-w-md">
        <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

/**
 * DATA HEALTH as the mark itself: each arc is one dimension of coverage, drawn
 * to the degree it is satisfied. Not a donut chart.
 */
export function HealthPulse({
  checks,
  size = 132,
}: {
  checks: { label: string; ok: boolean }[];
  size?: number;
}) {
  const score = Math.round((checks.filter((c) => c.ok).length / Math.max(1, checks.length)) * 100);
  const radii = [5.4, 8.6, 11.8, 14.6, 17.4];

  return (
    <div className="flex items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 44 44" width={size} height={size} fill="none" aria-hidden>
          {checks.map((check, i) => {
            const r = radii[Math.min(i, radii.length - 1)] ?? 6;
            const circumference = 2 * Math.PI * r;
            const sweep = check.ok ? 0.62 : 0.16;
            return (
              <circle
                key={check.label}
                cx="22"
                cy="22"
                r={r}
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                className={check.ok ? "text-primary" : "text-border-strong"}
                strokeDasharray={`${circumference * sweep} ${circumference}`}
                transform={`rotate(${-90 + i * 44} 22 22)`}
                opacity={check.ok ? 1 - i * 0.11 : 0.85}
              />
            );
          })}
          <circle cx="22" cy="22" r="1.9" className="fill-primary" />
        </svg>
      </div>
      <div>
        <p className="figure text-4xl">{score}%</p>
        <p className="label-faint mt-1">Signal coverage</p>
      </div>
    </div>
  );
}

/** A processing pipeline that only ever shows states that truly occurred. */
export function SignalPipeline({
  steps,
  current,
}: {
  steps: readonly string[];
  /** Index of the step in progress; steps before it are complete. -1 = idle. */
  current: number;
}) {
  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, i) => {
        const done = current > i;
        const active = current === i;
        return (
          <li key={step} className="flex items-stretch gap-3">
            <div className="flex w-4 flex-col items-center">
              <span
                className={cn(
                  "mt-1.5 size-2 rounded-full transition-colors duration-200",
                  done ? "bg-primary" : active ? "bg-primary" : "bg-border-strong",
                )}
              />
              {i < steps.length - 1 ? (
                <span className={cn("w-px flex-1", done ? "bg-primary/50" : "bg-border")} />
              ) : null}
            </div>
            <div className={cn("pb-4", !done && !active && "opacity-45")}>
              <p className={cn("label-mono", active && "text-primary")}>{step}</p>
              {active ? <SignalScan className="mt-1.5" /> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Ambient pointer light. The canvas responds to the cursor without replacing
 * it — the accent field follows horizontally, nothing else changes.
 */
export function usePointerField() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        node.style.setProperty("--pointer-x", `${(event.clientX / window.innerWidth) * 100}%`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}

/** Brand watermark used behind genuinely empty regions. */
export function EmptyField({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="pulse-grid relative flex min-h-[16rem] flex-col justify-center overflow-hidden border-y border-border px-6 py-14">
      <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.07]">
        <SocialPulseMark size={190} className="text-primary" />
      </div>
      <div className="relative max-w-md">
        <p className="label-faint">No signal yet</p>
        <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

/** Sparkline used inline as evidence beneath an observation. */
export function EvidenceSpark({
  values,
  color = "var(--color-primary)",
  width = 120,
  height = 30,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden>
      <polyline points={points} stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle
        cx={width}
        cy={height - ((values[values.length - 1]! - min) / span) * (height - 4) - 2}
        r="2"
        fill={color}
      />
    </svg>
  );
}

/** Fluid tab indicator used for segmented controls. */
export function useFluidIndex(initial = 0) {
  const [index, setIndex] = useState(initial);
  return { index, setIndex };
}
