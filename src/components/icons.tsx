import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * SOCIALPULSE ICON LANGUAGE
 * =========================
 * Every icon is built from the same three primitives as the mark: an arc, a
 * straight segment and a node. 24-unit grid, 1.7 stroke, round caps, no fills
 * except nodes (r=1.6). Lucide is used only for generic utility affordances
 * (close, chevron, search); anything that names a SocialPulse concept uses
 * these.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Glyph({ size = 18, className, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Audience — nodes gathered on a shared arc. */
export function IconAudience(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3.5 17.5a8.5 8.5 0 0 1 17 0" />
      <circle cx="7" cy="9.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="17" cy="9.5" r="1.6" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Growth — a measured step upward, node at the reading. */
export function IconGrowth(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 18.5 8 13l3.5 3L19 7.5" />
      <path d="M14.5 7.5H19V12" />
      <circle cx="8" cy="13" r="1.4" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Engagement — two arcs answering each other. */
export function IconEngagement(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 14.5A7 7 0 0 1 11 7.5" />
      <path d="M20 9.5a7 7 0 0 1-7 7" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Content — stacked frames, the top one live. */
export function IconContent(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3.5" y="4.5" width="17" height="11" rx="1.5" />
      <path d="M6.5 19h11" />
      <path d="M10.5 8.5 14 10l-3.5 1.5z" fill="currentColor" />
    </Glyph>
  );
}

/** Insights — an observation isolated from the field. */
export function IconInsight(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
      <circle cx="10.5" cy="10.5" r="1.6" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Pulse — the mark, reduced to a single icon-weight statement. */
export function IconPulse(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M15.2 8.6a4 4 0 0 1 .8 4.6" />
      <path d="M18.6 6a8 8 0 0 1-1.6 11.6" />
      <path d="M8.8 15.4a4 4 0 0 1-.8-4.6" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Activity — a recorded sequence along a baseline. */
export function IconActivity(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3.5 12h3.2l2.3-5 3 10 2.4-6.5 1.7 3h4.4" />
    </Glyph>
  );
}

/** Data health — coverage measured as an arc that has not closed. */
export function IconHealth(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 4a8 8 0 1 1-5.7 2.4" />
      <path d="M12 4v4" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Milestone — a threshold crossed on the timeline. */
export function IconMilestone(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M7 20V4" />
      <path d="M7 5.5h10l-2.4 3.2L17 12H7" />
    </Glyph>
  );
}

/** Signal — something meaningful detected. */
export function IconSignal(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 4v16" />
      <path d="M7.5 8v8" />
      <path d="M16.5 8v8" />
      <path d="M3.5 10.5v3" />
      <path d="M20.5 10.5v3" />
    </Glyph>
  );
}

/** Import — external data entering the system. */
export function IconImport(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3.5v10" />
      <path d="M8.5 10 12 13.5 15.5 10" />
      <path d="M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
    </Glyph>
  );
}

/** Accounts — separate presences held on one axis. */
export function IconAccounts(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 7.5h16" />
      <path d="M4 16.5h16" />
      <circle cx="9" cy="7.5" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="16.5" r="2.2" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Overview — the command surface. */
export function IconOverview(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 19a8 8 0 1 1 16 0" />
      <path d="M12 12.5 16 9" />
      <circle cx="12" cy="13" r="1.6" fill="currentColor" stroke="none" />
    </Glyph>
  );
}
