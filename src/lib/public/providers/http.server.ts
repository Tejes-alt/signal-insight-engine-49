/** Shared fetch helpers for public-profile sources. Server-only. */

export class SourceUnavailableError extends Error {
  constructor(message = "Public data isn't currently available for this platform.") {
    super(message);
    this.name = "SourceUnavailableError";
  }
}

export class ProfileNotFoundError extends Error {
  constructor(message = "Couldn't find this account.") {
    super(message);
    this.name = "ProfileNotFoundError";
  }
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function fetchText(
  url: string,
  init: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 12_000);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        "accept-language": "en-US,en;q=0.9",
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        ...init.headers,
      },
      signal: controller.signal,
      redirect: "follow",
    });
    const body = await res.text();
    return { status: res.status, body };
  } catch {
    throw new SourceUnavailableError();
  } finally {
    clearTimeout(timer);
  }
}

/** Parses compact counts such as "30.3M subscribers" or "1,204 followers". */
export function parseCompactNumber(input: string | null | undefined): number | null {
  if (!input) return null;
  const match = input.replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = (match[2] ?? "").toUpperCase();
  const factor = unit === "K" ? 1e3 : unit === "M" ? 1e6 : unit === "B" ? 1e9 : 1;
  return Math.round(value * factor);
}

export function firstMatch(body: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function decodeHtml(input: string | null): string | null {
  if (!input) return null;
  return input
    .replace(/\\u0026/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\"/g, '"')
    .trim();
}
