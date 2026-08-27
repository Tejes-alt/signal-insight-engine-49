/**
 * Shared, client-safe vocabulary for manual entries and file imports.
 *
 * SocialPulse never invents a number. Everything here describes how a value a
 * person supplies is recognised, validated and labelled — nothing is generated.
 */

export const METRIC_FIELDS = [
  { key: "followers", label: "Followers", aliases: ["follower", "followers", "subscribers", "subscriber count", "subs", "connections", "fans", "page likes"] },
  { key: "following", label: "Following", aliases: ["following", "follows"] },
  { key: "posts", label: "Posts", aliases: ["posts", "post count", "videos", "content", "tweets", "media count"] },
  { key: "views", label: "Views", aliases: ["views", "video views", "plays", "watch count"] },
  { key: "likes", label: "Likes", aliases: ["likes", "reactions", "favorites", "hearts"] },
  { key: "comments", label: "Comments", aliases: ["comments", "replies"] },
  { key: "shares", label: "Shares", aliases: ["shares", "reposts", "retweets"] },
  { key: "saves", label: "Saves", aliases: ["saves", "saved", "bookmarks"] },
  { key: "reach", label: "Reach", aliases: ["reach", "accounts reached", "unique views"] },
  { key: "impressions", label: "Impressions", aliases: ["impressions", "views (impressions)"] },
  { key: "profile_visits", label: "Profile visits", aliases: ["profile visits", "profile views", "visits"] },
] as const;

export type MetricField = (typeof METRIC_FIELDS)[number]["key"];

export const METRIC_LABEL: Record<MetricField, string> = Object.fromEntries(
  METRIC_FIELDS.map((f) => [f.key, f.label]),
) as Record<MetricField, string>;

export const DATE_ALIASES = ["date", "day", "captured", "captured at", "timestamp", "period", "week", "month", "published", "published at", "post date"];
export const TITLE_ALIASES = ["title", "caption", "text", "description", "post", "name", "content title"];
export const URL_ALIASES = ["url", "link", "permalink", "post url", "post link"];

/** Every column a row can be mapped to. */
export type TargetField = MetricField | "date" | "title" | "url" | "ignore";

export const TARGET_OPTIONS: { key: TargetField; label: string }[] = [
  { key: "ignore", label: "Don't import" },
  { key: "date", label: "Date" },
  { key: "title", label: "Title / caption" },
  { key: "url", label: "Link" },
  ...METRIC_FIELDS.map((f) => ({ key: f.key as TargetField, label: f.label })),
];

const normalize = (value: string) => value.trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");

/** Best-guess mapping for a spreadsheet header. Always user-confirmable. */
export function guessTarget(header: string): TargetField {
  const h = normalize(header);
  if (!h) return "ignore";
  if (DATE_ALIASES.some((a) => h === a || h.includes(a))) return "date";
  for (const field of METRIC_FIELDS) {
    if (field.aliases.some((a) => h === a)) return field.key;
  }
  for (const field of METRIC_FIELDS) {
    if (field.aliases.some((a) => h.includes(a))) return field.key;
  }
  if (URL_ALIASES.some((a) => h.includes(a))) return "url";
  if (TITLE_ALIASES.some((a) => h.includes(a))) return "title";
  return "ignore";
}

/** Parses "12,345", "12.3K", "1.2M", "3 456" and plain numbers. Never guesses. */
export function parseNumber(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input) : null;
  if (typeof input !== "string") return null;
  const raw = input.trim().replace(/\s|,/g, "");
  if (!raw) return null;
  const match = /^(-?\d+(?:\.\d+)?)([kmb])?$/i.exec(raw);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = match[2]?.toLowerCase();
  const factor = unit === "k" ? 1_000 : unit === "m" ? 1_000_000 : unit === "b" ? 1_000_000_000 : 1;
  return Math.round(value * factor);
}

/** Accepts ISO, US and European date text; returns an ISO timestamp or null. */
export function parseDate(input: unknown): string | null {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input.toISOString();
  if (typeof input === "number") {
    // Spreadsheet serial date (days since 1899-12-30).
    if (input > 20_000 && input < 60_000) return new Date(Math.round((input - 25_569) * 86_400_000)).toISOString();
    return null;
  }
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00.000Z`).toISOString();
  const slash = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(text);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    // Ambiguous D/M vs M/D: only the unambiguous ordering is trusted.
    const [day, month] = a > 12 ? [a, b] : [b, a];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return new Date(Date.UTC(Number(slash[3]), month - 1, day, 12)).toISOString();
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export interface PreparedRow {
  index: number;
  capturedAt: string | null;
  title: string | null;
  url: string | null;
  metrics: Partial<Record<MetricField, number>>;
  problems: string[];
}

export interface PreparedFile {
  rows: PreparedRow[];
  validCount: number;
  metricColumns: MetricField[];
  hasDate: boolean;
  hasContent: boolean;
}

/** Applies a confirmed mapping to raw rows and reports every problem found. */
export function prepareRows(
  rawRows: Record<string, unknown>[],
  mapping: Record<string, TargetField>,
): PreparedFile {
  const metricColumns = Array.from(
    new Set(Object.values(mapping).filter((t): t is MetricField => t !== "ignore" && t !== "date" && t !== "title" && t !== "url")),
  );
  const hasDate = Object.values(mapping).includes("date");
  const hasContent = Object.values(mapping).includes("title") || Object.values(mapping).includes("url");

  const rows: PreparedRow[] = rawRows.map((raw, index) => {
    const problems: string[] = [];
    const metrics: Partial<Record<MetricField, number>> = {};
    let capturedAt: string | null = null;
    let title: string | null = null;
    let url: string | null = null;

    for (const [column, target] of Object.entries(mapping)) {
      if (target === "ignore") continue;
      const value = raw[column];
      if (target === "date") {
        capturedAt = parseDate(value);
        if (value !== undefined && value !== "" && !capturedAt) problems.push(`Couldn't read the date "${String(value)}"`);
        continue;
      }
      if (target === "title") {
        title = typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : null;
        continue;
      }
      if (target === "url") {
        url = typeof value === "string" && value.trim() ? value.trim() : null;
        continue;
      }
      if (value === undefined || value === null || value === "") continue;
      const number = parseNumber(value);
      if (number === null) problems.push(`Couldn't read "${String(value)}" as a ${METRIC_LABEL[target].toLowerCase()}`);
      else if (number < 0) problems.push(`${METRIC_LABEL[target]} can't be negative`);
      else metrics[target] = number;
    }

    if (Object.keys(metrics).length === 0 && !title && !url) problems.push("Nothing to import from this row");
    if (capturedAt && Date.parse(capturedAt) > Date.now() + 86_400_000) problems.push("That date is in the future");

    return { index, capturedAt, title, url, metrics, problems };
  });

  return {
    rows,
    validCount: rows.filter((r) => r.problems.length === 0).length,
    metricColumns,
    hasDate,
    hasContent,
  };
}

export const SOURCE_LABEL: Record<string, string> = {
  public: "Public profile",
  manual: "Entered manually",
  import: "Imported file",
  screenshot: "From a screenshot",
};
