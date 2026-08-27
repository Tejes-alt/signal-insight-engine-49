import { AnimatedNumber, formatNumber } from "@/components/metrics";

/**
 * The SocialPulse signature: a slowly expanding halo around the total audience.
 * Purely decorative — the number itself is real data.
 */
export function PulseRing({ total, label = "Total audience" }: { total: number | null; label?: string }) {
  return (
    <div className="relative grid place-items-center py-6">
      <span
        className="pointer-events-none absolute size-40 rounded-full border border-primary/30 halo-ring"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute size-40 rounded-full border border-primary/20 halo-ring"
        style={{ animationDelay: "1.2s" }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute size-28 rounded-full blur-2xl"
        style={{ background: "color-mix(in oklab, var(--color-primary) 28%, transparent)" }}
        aria-hidden
      />
      <div className="relative grid size-36 place-items-center rounded-full border border-border bg-background/40 text-center backdrop-blur-sm">
        <div>
          <p className="font-display text-3xl font-semibold tracking-tight tabular">
            {total === null ? "—" : <AnimatedNumber value={total} format={formatNumber} />}
          </p>
          <p className="label-mono mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}
