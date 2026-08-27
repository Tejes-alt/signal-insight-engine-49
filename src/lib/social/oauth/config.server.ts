/**
 * Server-side integration configuration. Server-only.
 *
 * Developer credentials live exclusively in server secrets. They are never
 * returned to the browser — only a boolean "configured" flag is.
 */

import type { PlatformId } from "../platforms";

export interface IntegrationRequirement {
  platform: PlatformId;
  /** Secret names read from the server environment. */
  secrets: { id: string; secret: string }[];
  /** Extra platform gate the developer must clear (approval, account type…). */
  approvalNote: string | null;
}

export const INTEGRATION_REQUIREMENTS: Record<PlatformId, IntegrationRequirement> = {
  youtube: {
    platform: "youtube",
    secrets: [
      { id: "clientId", secret: "GOOGLE_CLIENT_ID" },
      { id: "clientSecret", secret: "GOOGLE_CLIENT_SECRET" },
    ],
    approvalNote: null,
  },
  instagram: {
    platform: "instagram",
    secrets: [
      { id: "clientId", secret: "META_APP_ID" },
      { id: "clientSecret", secret: "META_APP_SECRET" },
    ],
    approvalNote:
      "Instagram insights are only available for Business or Creator accounts linked to a Facebook Page, and Meta must approve the app for public use.",
  },
  facebook: {
    platform: "facebook",
    secrets: [
      { id: "clientId", secret: "META_APP_ID" },
      { id: "clientSecret", secret: "META_APP_SECRET" },
    ],
    approvalNote: "Facebook analytics cover Pages only; Meta app review is required outside test users.",
  },
  linkedin: {
    platform: "linkedin",
    secrets: [
      { id: "clientId", secret: "LINKEDIN_CLIENT_ID" },
      { id: "clientSecret", secret: "LINKEDIN_CLIENT_SECRET" },
    ],
    approvalNote:
      "Member profile and page analytics require LinkedIn partner approval; without it only basic profile data is returned.",
  },
  tiktok: {
    platform: "tiktok",
    secrets: [
      { id: "clientId", secret: "TIKTOK_CLIENT_KEY" },
      { id: "clientSecret", secret: "TIKTOK_CLIENT_SECRET" },
    ],
    approvalNote: "TikTok requires an approved developer app with the Display API and Analytics scopes enabled.",
  },
  twitter: {
    platform: "twitter",
    secrets: [
      { id: "clientId", secret: "X_CLIENT_ID" },
      { id: "clientSecret", secret: "X_CLIENT_SECRET" },
    ],
    approvalNote: "Post impression metrics on X need a paid API tier; follower and public post data work on the free tier.",
  },
};

export interface IntegrationConfig {
  clientId: string;
  clientSecret: string;
}

export interface IntegrationStatus {
  platform: PlatformId;
  configured: boolean;
  missing: string[];
  approvalNote: string | null;
}

export function integrationStatus(platform: PlatformId): IntegrationStatus {
  const requirement = INTEGRATION_REQUIREMENTS[platform];
  const missing = requirement.secrets.filter((s) => !process.env[s.secret]).map((s) => s.secret);
  return {
    platform,
    configured: missing.length === 0,
    missing,
    approvalNote: requirement.approvalNote,
  };
}

export function allIntegrationStatuses(): IntegrationStatus[] {
  return (Object.keys(INTEGRATION_REQUIREMENTS) as PlatformId[]).map(integrationStatus);
}

export function integrationConfig(platform: PlatformId): IntegrationConfig | null {
  const requirement = INTEGRATION_REQUIREMENTS[platform];
  const entries: Record<string, string> = {};
  for (const s of requirement.secrets) {
    const v = process.env[s.secret];
    if (!v) return null;
    entries[s.id] = v;
  }
  return { clientId: entries["clientId"]!, clientSecret: entries["clientSecret"]! };
}

/** Optional public-data key used for read-only account discovery. */
export function youtubePublicKey(): string | null {
  return process.env["YOUTUBE_API_KEY"] ?? process.env["GOOGLE_API_KEY"] ?? null;
}
