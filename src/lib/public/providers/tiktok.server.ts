import {
  ProfileNotFoundError,
  SourceUnavailableError,
  decodeHtml,
  fetchText,
  firstMatch,
} from "./http.server";
import { stripHandle, type PublicSourceProvider, type ResolvedAccount } from "./types";
import type { PublicContentItem } from "../types";

const num = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** TikTok public source: reads the openly published creator page. */
export const tiktokProvider: PublicSourceProvider = {
  id: "tiktok",
  supports: ["followers", "following", "posts", "likes"],

  normalizeHandle: (input) => stripHandle(input),
  profileUrl: (handle) => `https://www.tiktok.com/@${handle}`,

  async resolve(handle): Promise<ResolvedAccount> {
    const url = this.profileUrl(handle);
    const { status, body } = await fetchText(url);
    if (status === 404) throw new ProfileNotFoundError();
    if (status >= 400 || body.length < 2000) throw new SourceUnavailableError();
    if (/Couldn't find this account|user does not exist/i.test(body)) throw new ProfileNotFoundError();

    const followers = num(firstMatch(body, [/"followerCount":(\d+)/]));
    if (followers === null && !/"uniqueId":"/.test(body)) throw new SourceUnavailableError();

    return {
      profile: {
        handle,
        externalId: firstMatch(body, [/"id":"(\d{6,})","nickname"/, /"authorId":"(\d+)"/]),
        displayName: decodeHtml(firstMatch(body, [/"nickname":"([^"]*)"/])) || handle,
        avatarUrl: decodeHtml(firstMatch(body, [/"avatarLarger":"([^"]+)"/, /"avatarMedium":"([^"]+)"/])),
        bio: decodeHtml(firstMatch(body, [/"signature":"([^"]*)"/])),
        profileUrl: url,
      },
      metrics: {
        followers,
        following: num(firstMatch(body, [/"followingCount":(\d+)/])),
        posts: num(firstMatch(body, [/"videoCount":(\d+)/])),
        likes: num(firstMatch(body, [/"heartCount":(\d+)/, /"heart":(\d+)/])),
      },
    };
  },

  async content(account): Promise<PublicContentItem[]> {
    const { status, body } = await fetchText(this.profileUrl(account.profile.handle));
    if (status >= 400) return [];
    const items: PublicContentItem[] = [];
    const regex = /"id":"(\d{12,})"[^{]*?,"desc":"([^"]*)"[\s\S]{0,400}?"createTime":(\d+)[\s\S]{0,2000}?"playCount":(\d+),"diggCount":(\d+),"commentCount":(\d+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(body)) && items.length < 20) {
      items.push({
        externalId: match[1]!,
        title: decodeHtml(match[2]!) || "TikTok video",
        url: `https://www.tiktok.com/@${account.profile.handle}/video/${match[1]}`,
        thumbnailUrl: null,
        publishedAt: new Date(Number(match[3]) * 1000).toISOString(),
        views: Number(match[4]),
        likes: Number(match[5]),
        comments: Number(match[6]),
      });
    }
    return items;
  },
};
