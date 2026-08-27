/**
 * Shared HTTP + OAuth plumbing for every provider. Server-only.
 */

import { ProviderRequestError } from "./types";

export async function requestJson<T>(
  url: string,
  init: RequestInit & { platformName: string },
): Promise<T> {
  const { platformName, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(url, rest);
  } catch (error) {
    throw new ProviderRequestError(
      `${platformName} could not be reached right now.`,
      503,
      "network_error",
    );
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const detail =
      (body as { error?: { message?: string }; error_description?: string; message?: string } | null) ?? null;
    const message =
      detail?.error?.message ?? detail?.error_description ?? detail?.message ?? `${platformName} returned an error.`;
    const code =
      response.status === 401 || response.status === 403
        ? "not_authorized"
        : response.status === 429
          ? "rate_limited"
          : "provider_error";
    throw new ProviderRequestError(message, response.status, code);
  }
  return body as T;
}

export function form(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

export function buildAuthUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

export function expiryFromSeconds(seconds?: number | null): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);
