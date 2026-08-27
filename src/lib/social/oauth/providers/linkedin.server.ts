/**
 * LinkedIn integration — LinkedIn OAuth 2.0 + the Marketing/Member APIs.
 * Server-only.
 *
 * Without LinkedIn partner approval the platform only returns profile data, so
 * analytics that require approval are reported as unavailable with the reason
 * rather than invented.
 */

import type { JsonObject } from "@/lib/json";
import { integrationConfig } from "../config.server";
import { buildAuthUrl, expiryFromSeconds, form, requestJson } from "../http.server";
import {
  absent,
  IntegrationNotConfiguredError,
  value,
  type AuthorizeRequest,
  type CallbackRequest,
  type ProviderAccount,
  type ProviderAnalytics,
  type ProviderContentItem,
  type SocialProvider,
  type StoredMetrics,
  type TokenSet,
} from "../types";

const SCOPES = ["openid", "profile", "email", "w_member_social"];
const ORG_SCOPES = ["r_organization_social", "rw_organization_admin"];

function config() {
  const cfg = integrationConfig("linkedin");
  if (!cfg) throw new IntegrationNotConfiguredError("linkedin", ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"]);
  return cfg;
}

function requestedScopes(): string[] {
  return process.env["LINKEDIN_ORGANIZATION_ACCESS"] === "true" ? [...SCOPES, ...ORG_SCOPES] : SCOPES;
}

const NEEDS_APPROVAL =
  "LinkedIn only shares this metric with approved Marketing API partners; this installation does not have that approval yet.";

export const linkedinProvider: SocialProvider = {
  id: "linkedin",
  requiredSecrets: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  capabilities: ["followers", "impressions", "likes", "comments", "shares", "posts", "engagement", "engagementRate"],

  async discoverAccount(hint) {
    const handle = hint.handle?.trim().replace(/^@/, "");
    if (!handle) return null;
    // LinkedIn forbids scraping, so a suggestion is only ever a formatted guess
    // the user has to confirm by authorizing.
    return {
      platform: "linkedin",
      handle,
      displayName: null,
      avatarUrl: null,
      profileUrl: `https://www.linkedin.com/in/${handle}`,
      confidence: "possible",
      source: "manual",
    };
  },

  async connect(req: AuthorizeRequest) {
    const cfg = config();
    return {
      url: buildAuthUrl("https://www.linkedin.com/oauth/v2/authorization", {
        response_type: "code",
        client_id: cfg.clientId,
        redirect_uri: req.redirectUri,
        state: req.state,
        scope: requestedScopes().join(" "),
      }),
    };
  },

  async callback(req: CallbackRequest) {
    const cfg = config();
    const data = await requestJson<{ access_token: string; expires_in?: number; refresh_token?: string; scope?: string }>(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        platformName: "LinkedIn",
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form({
          grant_type: "authorization_code",
          code: req.code,
          redirect_uri: req.redirectUri,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
        }),
      },
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: expiryFromSeconds(data.expires_in),
      scopes: data.scope?.split(" ") ?? requestedScopes(),
    };
  },

  async refresh(token: TokenSet) {
    if (!token.refreshToken) return null;
    const cfg = config();
    const data = await requestJson<{ access_token: string; expires_in?: number; refresh_token?: string }>(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        platformName: "LinkedIn",
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form({
          grant_type: "refresh_token",
          refresh_token: token.refreshToken,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
        }),
      },
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: expiryFromSeconds(data.expires_in),
      scopes: token.scopes,
    };
  },

  async getAccount(token: TokenSet): Promise<ProviderAccount> {
    const me = await requestJson<{
      sub: string;
      name?: string;
      given_name?: string;
      picture?: string;
      email?: string;
    }>("https://api.linkedin.com/v2/userinfo", {
      platformName: "LinkedIn",
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    return {
      externalId: me.sub,
      handle: me.name ?? me.given_name ?? null,
      displayName: me.name ?? null,
      avatarUrl: me.picture ?? null,
      profileUrl: "https://www.linkedin.com/feed/",
      metadata: {} as JsonObject,
    };
  },

  async getAnalytics(token: TokenSet, account: ProviderAccount): Promise<ProviderAnalytics> {
    const metrics: StoredMetrics = {};
    const history: ProviderAnalytics["history"] = [];

    if (token.scopes.includes("r_organization_social")) {
      try {
        const orgs = await requestJson<{ elements?: { organizationalTarget: string }[] }>(
          "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget))",
          { platformName: "LinkedIn", headers: { Authorization: `Bearer ${token.accessToken}` } },
        );
        const org = orgs.elements?.[0]?.organizationalTarget;
        if (org) {
          const stats = await requestJson<{
            elements?: { followerCounts?: { organicFollowerCount?: number; paidFollowerCount?: number } }[];
          }>(
            `https://api.linkedin.com/v2/networkSizes/${encodeURIComponent(org)}?edgeType=CompanyFollowedByMember`,
            { platformName: "LinkedIn", headers: { Authorization: `Bearer ${token.accessToken}` } },
          );
          const count = stats.elements?.[0]?.followerCounts?.organicFollowerCount;
          if (count != null) metrics.followers = value(count);
        }
      } catch (error) {
        metrics.followers = absent(
          "not_authorized",
          error instanceof Error ? error.message : NEEDS_APPROVAL,
        );
      }
    }

    metrics.followers = metrics.followers ?? absent("not_authorized", NEEDS_APPROVAL);
    metrics.impressions = absent("not_authorized", NEEDS_APPROVAL);
    metrics.engagement = absent("not_authorized", NEEDS_APPROVAL);
    metrics.reach = absent("not_supported", "LinkedIn does not report reach.");
    metrics.saves = absent("not_supported", "LinkedIn does not report saves.");
    void account;
    return { metrics, history };
  },

  async getContent(token: TokenSet): Promise<ProviderContentItem[]> {
    if (!token.scopes.includes("r_organization_social")) return [];
    try {
      const posts = await requestJson<{
        elements?: {
          id: string;
          created?: { time: number };
          commentary?: string;
        }[];
      }>("https://api.linkedin.com/rest/posts?q=author&count=25", {
        platformName: "LinkedIn",
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          "LinkedIn-Version": "202405",
        },
      });
      return (posts.elements ?? []).map((p) => ({
        externalId: p.id,
        title: p.commentary?.slice(0, 90) ?? null,
        caption: p.commentary ?? null,
        mediaType: "post",
        thumbnailUrl: null,
        permalink: `https://www.linkedin.com/feed/update/${p.id}`,
        publishedAt: new Date(p.created?.time ?? Date.now()).toISOString(),
        metrics: {
          likes: absent("not_authorized", NEEDS_APPROVAL),
          comments: absent("not_authorized", NEEDS_APPROVAL),
          impressions: absent("not_authorized", NEEDS_APPROVAL),
        },
      }));
    } catch {
      return [];
    }
  },

  async getContentAnalytics(_token, _account, items) {
    return items;
  },

  async disconnect() {
    // LinkedIn has no public revocation endpoint; the stored credential is deleted.
  },
};
