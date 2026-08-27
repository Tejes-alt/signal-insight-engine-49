import {
  ProfileNotFoundError,
  SourceUnavailableError,
  decodeHtml,
  fetchText,
  firstMatch,
  parseCompactNumber,
} from "./http.server";
import { stripHandle, type PublicSourceProvider, type ResolvedAccount } from "./types";
import type { PublicContentItem } from "../types";

/**
 * LinkedIn public source: reads the openly published profile or company page.
 * LinkedIn hides most counters from anonymous visitors, so only what is
 * actually present is reported.
 */
export const linkedinProvider: PublicSourceProvider = {
  id: "linkedin",
  supports: ["followers"],

  normalizeHandle: (input) => stripHandle(input).replace(/^(in|company)\//i, ""),
  profileUrl: (handle) => `https://www.linkedin.com/in/${handle}/`,

  async resolve(handle): Promise<ResolvedAccount> {
    const candidates = [
      `https://www.linkedin.com/in/${handle}/`,
      `https://www.linkedin.com/company/${handle}/`,
    ];
    for (const url of candidates) {
      const { status, body } = await fetchText(url);
      if (status === 404) continue;
      if (status !== 200 || body.length < 1000) continue;
      const title = decodeHtml(firstMatch(body, [/<meta property="og:title" content="([^"]+)"/]));
      if (!title) continue;
      return {
        profile: {
          handle,
          externalId: null,
          displayName: title.replace(/\s*\|\s*LinkedIn\s*$/i, ""),
          avatarUrl: decodeHtml(firstMatch(body, [/<meta property="og:image" content="([^"]+)"/])),
          bio: decodeHtml(firstMatch(body, [/<meta name="description" content="([^"]*)"/])),
          profileUrl: url,
        },
        metrics: {
          followers: parseCompactNumber(
            firstMatch(body, [/"followerCount":(\d+)/, /([\d.,]+[KMB]?)\s+followers/i]),
          ),
        },
      };
    }
    throw new ProfileNotFoundError();
  },

  async content(): Promise<PublicContentItem[]> {
    return [];
  },
};

export const _unavailable = SourceUnavailableError;
