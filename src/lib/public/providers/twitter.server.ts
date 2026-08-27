import { ProfileNotFoundError, SourceUnavailableError, decodeHtml, fetchText, firstMatch } from "./http.server";
import { stripHandle, type PublicSourceProvider, type ResolvedAccount } from "./types";
import type { PublicContentItem } from "../types";

const num = (value: string | null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * X public source: reads the openly embeddable public profile timeline
 * document. X aggressively throttles anonymous access, in which case the
 * account is reported as temporarily unavailable rather than guessed.
 */
export const twitterProvider: PublicSourceProvider = {
  id: "twitter",
  supports: ["followers", "following", "posts"],

  normalizeHandle: (input) => stripHandle(input),
  profileUrl: (handle) => `https://x.com/${handle}`,

  async resolve(handle): Promise<ResolvedAccount> {
    const { status, body } = await fetchText(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}`,
    );
    if (status === 404) throw new ProfileNotFoundError();
    if (status !== 200 || body.length < 500) throw new SourceUnavailableError();

    const followers = num(firstMatch(body, [/"followers_count":(\d+)/]));
    if (followers === null) throw new SourceUnavailableError();

    return {
      profile: {
        handle,
        externalId: firstMatch(body, [/"id_str":"(\d+)"/]),
        displayName: decodeHtml(firstMatch(body, [/"name":"([^"]+)","screen_name"/])) || handle,
        avatarUrl: decodeHtml(firstMatch(body, [/"profile_image_url_https":"([^"]+)"/])),
        bio: decodeHtml(firstMatch(body, [/"description":"([^"]*)"/])),
        profileUrl: `https://x.com/${handle}`,
      },
      metrics: {
        followers,
        following: num(firstMatch(body, [/"friends_count":(\d+)/])),
        posts: num(firstMatch(body, [/"statuses_count":(\d+)/])),
      },
    };
  },

  async content(): Promise<PublicContentItem[]> {
    return [];
  },
};
