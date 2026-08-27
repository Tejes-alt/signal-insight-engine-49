import { PLATFORMS, type PlatformId } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

/** Brand accent per platform. */
export const PLATFORM_ACCENT: Record<PlatformId, string> = {
  youtube: PLATFORMS.youtube.accent,
  instagram: PLATFORMS.instagram.accent,
  linkedin: PLATFORMS.linkedin.accent,
  tiktok: PLATFORMS.tiktok.accent,
  twitter: PLATFORMS.twitter.accent,
  facebook: PLATFORMS.facebook.accent,
};

export function PlatformMark({
  provider,
  size = "md",
  className,
}: {
  provider: PlatformId;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const descriptor = PLATFORMS[provider];
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

export function platformName(provider: PlatformId) {
  return PLATFORMS[provider].name;
}
