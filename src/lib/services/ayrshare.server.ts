/**
 * Social provider abstraction (Ayrshare). Server-only.
 *
 * Every call to the provider goes through this module, so the rest of the app
 * never sees an endpoint, a header, or the API key. Swapping providers means
 * re-implementing `socialProvider` and nothing else.
 *
 * AYRSHARE_API_KEY is read inside each call — never at module scope, never in
 * anything reachable from the browser bundle, and never returned to the client.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { JsonObject, JsonValue } from "../json";

const BASE_URL = "https://api.ayrshare.com/api";

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super("The social integration provider is not configured yet.");
    this.name = "ProviderNotConfiguredError";
  }
}

export class ProviderRequestError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = "provider_error") {
    super(message);
    this.name = "ProviderRequestError";
    this.status = status;
    this.code = code;
  }
}

function apiKey(): string {
  const key = process.env["AYRSHARE_API_KEY"];
  if (!key) throw new ProviderNotConfiguredError();
  return key;
}

export interface ProviderConfigStatus {
  apiKeyConfigured: boolean;
  /** Hosted OAuth linking (generateJWT) needs a domain + private key. */
  linkingConfigured: boolean;
  missing: string[];
}

export function providerConfig(): ProviderConfigStatus {
  const missing: string[] = [];
  if (!process.env["AYRSHARE_API_KEY"]) missing.push("AYRSHARE_API_KEY");
  const linking = Boolean(process.env["AYRSHARE_DOMAIN"] && process.env["AYRSHARE_PRIVATE_KEY"]);
  if (!process.env["AYRSHARE_DOMAIN"]) missing.push("AYRSHARE_DOMAIN");
  if (!process.env["AYRSHARE_PRIVATE_KEY"]) missing.push("AYRSHARE_PRIVATE_KEY");
  return {
    apiKeyConfigured: Boolean(process.env["AYRSHARE_API_KEY"]),
    linkingConfigured: linking,
    missing,
  };
}

/* ------------------------------------------------------------------ */
/* Profile key encryption — the stored handle is never plaintext.      */
/* ------------------------------------------------------------------ */

function cryptoKey(): Buffer {
  const seed =
    process.env["APP_USER_CONNECTION_KEY_SECRET"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["SUPABASE_DB_URL"];
  if (!seed) throw new Error("No server key material available to encrypt provider credentials.");
  return createHash("sha256").update(seed).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cryptoKey(), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decryptSecret(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", cryptoKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: JsonObject | undefined;
  /** Per-user profile handle. Scopes the call to one SocialPulse workspace. */
  profileKey?: string | undefined;
  query?: Record<string, string> | undefined;
}

async function request<T = JsonValue>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
  };
  if (options.profileKey) headers["Profile-Key"] = options.profileKey;

  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(options.query ?? {})) url.searchParams.set(k, v);

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ProviderRequestError("The social provider could not be reached.", 503, "provider_unreachable");
  }

  const text = await response.text();
  let payload: JsonValue = null;
  try {
    payload = text ? (JSON.parse(text) as JsonValue) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const record = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
    const message =
      typeof record["message"] === "string"
        ? (record["message"] as string)
        : `The social provider rejected the request (${response.status}).`;
    const code =
      response.status === 429
        ? "rate_limited"
        : response.status === 401 || response.status === 403
          ? "not_authorized"
          : "provider_error";
    throw new ProviderRequestError(message, response.status, code);
  }

  return payload as T;
}

/* ------------------------------------------------------------------ */
/* Provider surface                                                    */
/* ------------------------------------------------------------------ */

export interface ProviderProfile {
  refId: string;
  profileKey: string;
  title: string;
}

export interface ProviderAccount {
  platform: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  externalId: string | null;
  metadata: JsonObject;
}

export const socialProvider = {
  isConfigured(): boolean {
    return Boolean(process.env["AYRSHARE_API_KEY"]);
  },

  async createProfile(title: string): Promise<ProviderProfile> {
    const result = await request<Record<string, unknown>>("/profiles/profile", {
      method: "POST",
      body: { title },
    });
    const profileKey = String(result["profileKey"] ?? "");
    if (!profileKey) throw new ProviderRequestError("The provider did not return a profile handle.", 502);
    return { refId: String(result["refId"] ?? ""), profileKey, title };
  },

  async deleteProfile(profileKey: string): Promise<void> {
    await request("/profiles/profile", { method: "DELETE", body: { profileKey } });
  },

  /** Hosted authorization URL for the official platform OAuth screens. */
  async connectAccount(input: {
    profileKey: string;
    redirect: string;
    platforms?: string[] | undefined;
  }): Promise<{ url: string }> {
    const domain = process.env["AYRSHARE_DOMAIN"];
    const privateKey = process.env["AYRSHARE_PRIVATE_KEY"];
    if (!domain || !privateKey) {
      throw new ProviderRequestError(
        "Account linking is not configured yet. The workspace domain and linking key must be set on the server.",
        503,
        "linking_not_configured",
      );
    }
    const body: JsonObject = {
      domain,
      privateKey,
      profileKey: input.profileKey,
      redirect: input.redirect,
      logout: true,
    };
    if (input.platforms?.length) body["allowedSocial"] = input.platforms;
    const result = await request<Record<string, unknown>>("/profiles/generateJWT", {
      method: "POST",
      body,
    });
    const url = String(result["url"] ?? "");
    if (!url) throw new ProviderRequestError("The provider did not return an authorization URL.", 502);
    return { url };
  },

  async disconnectAccount(profileKey: string, platform: string): Promise<void> {
    await request("/profiles/social", { method: "DELETE", body: { platform }, profileKey });
  },

  /** Which platforms the user has actually authorized. */
  async getConnectionStatus(profileKey: string): Promise<ProviderAccount[]> {
    const result = await request<Record<string, unknown>>("/user", { profileKey });
    const active = Array.isArray(result["activeSocialAccounts"])
      ? (result["activeSocialAccounts"] as string[])
      : [];
    const details = Array.isArray(result["displayNames"])
      ? (result["displayNames"] as Record<string, unknown>[])
      : [];
    const byPlatform = new Map<string, Record<string, unknown>>();
    for (const entry of details) {
      const platform = String(entry["platform"] ?? "");
      if (platform) byPlatform.set(platform, entry);
    }
    return active.map((platform) => {
      const entry = byPlatform.get(platform) ?? {};
      return {
        platform,
        username: (entry["username"] as string | undefined) ?? null,
        displayName: (entry["displayName"] as string | undefined) ?? null,
        avatarUrl: (entry["userImage"] as string | undefined) ?? null,
        externalId: (entry["id"] as string | undefined) ?? null,
        metadata: entry as JsonObject,
      };
    });
  },

  /** Raw per-platform account analytics, keyed by platform. */
  async getAccountAnalytics(
    profileKey: string,
    platforms: string[],
  ): Promise<Record<string, Record<string, unknown>>> {
    if (platforms.length === 0) return {};
    const result = await request<Record<string, unknown>>("/analytics/social", {
      method: "POST",
      body: { platforms },
      profileKey,
    });
    const out: Record<string, Record<string, unknown>> = {};
    for (const platform of platforms) {
      const entry = result[platform];
      if (entry && typeof entry === "object") out[platform] = entry as Record<string, unknown>;
    }
    return out;
  },

  /** Published history for the profile, newest first. */
  async getHistory(profileKey: string, lastRecords = 100): Promise<Record<string, unknown>[]> {
    const result = await request<unknown>("/history", {
      profileKey,
      query: { lastRecords: String(lastRecords) },
    });
    if (Array.isArray(result)) return result as Record<string, unknown>[];
    const record = (result ?? {}) as Record<string, unknown>;
    const posts = record["history"] ?? record["posts"];
    return Array.isArray(posts) ? (posts as Record<string, unknown>[]) : [];
  },

  async getPostAnalytics(
    profileKey: string,
    id: string,
  ): Promise<Record<string, Record<string, unknown>>> {
    const result = await request<Record<string, unknown>>("/analytics/post", {
      method: "POST",
      body: { id },
      profileKey,
    });
    const out: Record<string, Record<string, unknown>> = {};
    for (const [platform, value] of Object.entries(result)) {
      if (value && typeof value === "object") out[platform] = value as Record<string, unknown>;
    }
    return out;
  },
};
