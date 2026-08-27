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
 * YouTube public source.
 *
 * Reads the openly published channel page (subscribers, name, picture, video
 * count) and the channel's public RSS feed (recent videos with public view and
 * like counts). No API key, no developer project, no user credentials.
 */
export const youtubeProvider: PublicSourceProvider = {
  id: "youtube",
  supports: ["followers", "posts", "views", "likes"],

  normalizeHandle(input) {
    const cleaned = stripHandle(input).replace(/^(c|user|channel)\//i, "");
    return cleaned.replace(/^@/, "");
  },

  profileUrl(handle) {
    return handle.startsWith("UC")
      ? `https://www.youtube.com/channel/${handle}`
      : `https://www.youtube.com/@${handle}`;
  },

  async resolve(handle): Promise<ResolvedAccount> {
    const url = this.profileUrl(handle);
    const { status, body } = await fetchText(url);
    if (status === 404) throw new ProfileNotFoundError();
    if (status >= 400 || body.length < 1000) throw new SourceUnavailableError();
    if (/This page isn't available|channel does not exist/i.test(body.slice(0, 400_000))) {
      throw new ProfileNotFoundError();
    }

    const channelId = firstMatch(body, [
      /"externalId":"(UC[\w-]+)"/,
      /channel_id=(UC[\w-]+)/,
      /"channelId":"(UC[\w-]+)"/,
    ]);
    if (!channelId) throw new ProfileNotFoundError();

    const displayName = decodeHtml(
      firstMatch(body, [/<meta property="og:title" content="([^"]+)"/, /"title":"([^"]+)","description"/]),
    );
    const avatarUrl = firstMatch(body, [/<meta property="og:image" content="([^"]+)"/]);
    const bio = decodeHtml(firstMatch(body, [/<meta property="og:description" content="([^"]*)"/]));
    const subscribers = parseCompactNumber(
      firstMatch(body, [
        /"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"/,
        /"subscriberCountText":\{"simpleText":"([^"]+)"/,
        /([\d.,]+[KMB]?) subscribers/,
      ]),
    );
    const videoCount = parseCompactNumber(
      firstMatch(body, [/"videosCountText":\{"runs":\[\{"text":"([\d.,KMB]+)"/, /([\d.,]+) videos/]),
    );

    return {
      profile: {
        handle: handle.replace(/^@/, ""),
        externalId: channelId,
        displayName: displayName ?? handle,
        avatarUrl,
        bio,
        profileUrl: url,
      },
      metrics: { followers: subscribers, posts: videoCount },
    };
  },

  async content(account): Promise<PublicContentItem[]> {
    const id = account.profile.externalId;
    if (!id) return [];
    const { status, body } = await fetchText(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`,
    );
    if (status >= 400) return [];
    const entries = body.split("<entry>").slice(1);
    return entries.map((entry) => {
      const videoId = firstMatch(entry, [/<yt:videoId>([^<]+)</]) ?? "";
      return {
        externalId: videoId,
        title: decodeHtml(firstMatch(entry, [/<title>([^<]*)</])),
        url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
        thumbnailUrl: firstMatch(entry, [/<media:thumbnail url="([^"]+)"/]),
        publishedAt: firstMatch(entry, [/<published>([^<]+)</]),
        views: Number(firstMatch(entry, [/<media:statistics views="(\d+)"/]) ?? NaN) || null,
        likes: Number(firstMatch(entry, [/<media:starRating count="(\d+)"/]) ?? NaN) || null,
        comments: null,
      } satisfies PublicContentItem;
    }).filter((item) => item.externalId);
  },
};
