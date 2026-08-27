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
 * Facebook public source: reads a public Page's openly published document.
 * Facebook blocks most anonymous access, so unavailability is normal and is
 * reported calmly rather than treated as an error.
 */
export const facebookProvider: PublicSourceProvider = {
  id: "facebook",
  supports: ["followers", "likes"],

  normalizeHandle: (input) => stripHandle(input),
  profileUrl: (handle) => `https://www.facebook.com/${handle}`,

  async resolve(handle): Promise<ResolvedAccount> {
    const { status, body } = await fetchText(`https://www.facebook.com/${encodeURIComponent(handle)}`);
    if (status === 404) throw new ProfileNotFoundError();
    if (status !== 200 || body.length < 2000) throw new SourceUnavailableError();
    const title = decodeHtml(firstMatch(body, [/<meta property="og:title" content="([^"]+)"/]));
    if (!title) throw new SourceUnavailableError();
    return {
      profile: {
        handle,
        externalId: firstMatch(body, [/"pageID":"(\d+)"/, /"userID":"(\d+)"/]),
        displayName: title,
        avatarUrl: decodeHtml(firstMatch(body, [/<meta property="og:image" content="([^"]+)"/])),
        bio: decodeHtml(firstMatch(body, [/<meta property="og:description" content="([^"]*)"/])),
        profileUrl: `https://www.facebook.com/${handle}`,
      },
      metrics: {
        followers: parseCompactNumber(
          firstMatch(body, [/([\d.,]+[KMB]?)\s+followers/i, /"follower_count":(\d+)/]),
        ),
        likes: parseCompactNumber(firstMatch(body, [/([\d.,]+[KMB]?)\s+likes/i])),
      },
    };
  },

  async content(): Promise<PublicContentItem[]> {
    return [];
  },
};
