import { PROVIDERS, type ProviderId } from "@/lib/providers/registry";
import { cn } from "@/lib/utils";

/** Brand accent per platform, resolved from design tokens (never hardcoded hex). */
export const PLATFORM_ACCENT: Record<ProviderId, string> = {
  youtube: "var(--color-youtube)",
  instagram: "var(--color-instagram)",
  linkedin: "var(--color-linkedin)",
  tiktok: "var(--color-tiktok)",
  x: "var(--color-x)",
  facebook: "var(--color-facebook)",
};

export function PlatformMark({
  provider,
  size = "md",
  className,
}: {
  provider: ProviderId;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const descriptor = PROVIDERS[provider];
  const accent = PLATFORM_ACCENT[provider];
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl font-display font-bold",
        size === "sm" && "size-7 text-[0.65rem]",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-12 text-base",
        className,
      )}
      style={{
        background: `color-mix(in oklab, ${accent} 18%, transparent)`,
        color: accent,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${accent} 35%, transparent)`,
      }}
      aria-hidden
    >
      {descriptor.mark}
    </span>
  );
}

export function platformName(provider: ProviderId) {
  return PROVIDERS[provider].name;
}
