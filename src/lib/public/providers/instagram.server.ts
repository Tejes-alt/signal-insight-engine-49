import {
  ProfileNotFoundError,
  SourceUnavailableError,
  decodeHtml,
  fetchText,
  firstMatch,
} from "./http.server";
import { stripHandle, type PublicSourceProvider, type ResolvedAccount } from "./types";
import type { PublicContentItem } from "../types";

interface IgNode {
  id?: string;
  shortcode?: string;
  display_url?: string;
  taken_at_timestamp?: number;
  edge_liked_by?: { count?: number };
  edge_media_to_comment?: { count?: number };
  video_view_count?: number;
  edge_media_to_caption?: { edges?: { node?: { text?: string } }[] };
}

/**
 * Instagram public source.
 *
 * Uses Instagram's openly reachable public profile document. When Instagram
 * throttles anonymous access — which it frequently does — the account is simply
 * marked as "public data isn't currently available" instead of failing.
 */
export const instagramProvider: PublicSourceProvider = {
  id: "instagram",
  supports: ["followers", "following", "posts", "likes", "comments"],

  normalizeHandle: (input) => stripHandle(input),
  profileUrl: (handle) => `https://www.instagram.com/${handle}/`,

  async resolve(handle): Promise<ResolvedAccount> {
    const { status, body } = await fetchText(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
      { headers: { "x-ig-app-id": "936619743392459", accept: "application/json" } },
    );
    if (status === 404) throw new ProfileNotFoundError();
    if (status !== 200) throw new SourceUnavailableError();

    let user: Record<string, unknown> | undefined;
    try {
      user = (JSON.parse(body) as { data?: { user?: Record<string, unknown> } }).data?.user;
    } catch {
      throw new SourceUnavailableError();
    }
    if (!user) throw new ProfileNotFoundError();

    const count = (key: string) =>
      typeof (user![key] as { count?: number } | undefined)?.count === "number"
        ? (user![key] as { count: number }).count
        : null;

    const media = (user["edge_owner_to_timeline_media"] as { edges?: { node?: IgNode }[] } | undefined)
      ?.edges ?? [];
    const likes = media.reduce((sum, e) => sum + (e.node?.edge_liked_by?.count ?? 0), 0);
    const comments = media.reduce((sum, e) => sum + (e.node?.edge_media_to_comment?.count ?? 0), 0);

    return {
      profile: {
        handle,
        externalId: (user["id"] as string) ?? null,
        displayName: (user["full_name"] as string) || handle,
        avatarUrl: (user["profile_pic_url_hd"] as string) ?? (user["profile_pic_url"] as string) ?? null,
        bio: (user["biography"] as string) ?? null,
        profileUrl: `https://www.instagram.com/${handle}/`,
      },
      metrics: {
        followers: count("edge_followed_by"),
        following: count("edge_follow"),
        posts: count("edge_owner_to_timeline_media"),
        likes: media.length ? likes : null,
        comments: media.length ? comments : null,
      },
    };
  },

  async content(account): Promise<PublicContentItem[]> {
    const { status, body } = await fetchText(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(
        account.profile.handle,
      )}`,
      { headers: { "x-ig-app-id": "936619743392459", accept: "application/json" } },
    );
    if (status !== 200) return [];
    try {
      const edges =
        (JSON.parse(body) as {
          data?: { user?: { edge_owner_to_timeline_media?: { edges?: { node?: IgNode }[] } } };
        }).data?.user?.edge_owner_to_timeline_media?.edges ?? [];
      return edges
        .map(({ node }) => node)
        .filter((node): node is IgNode => Boolean(node?.shortcode))
        .map((node) => ({
          externalId: node.shortcode!,
          title:
            decodeHtml(node.edge_media_to_caption?.edges?.[0]?.node?.text ?? null)?.slice(0, 180) ??
            "Instagram post",
          url: `https://www.instagram.com/p/${node.shortcode}/`,
          thumbnailUrl: node.display_url ?? null,
          publishedAt: node.taken_at_timestamp
            ? new Date(node.taken_at_timestamp * 1000).toISOString()
            : null,
          views: node.video_view_count ?? null,
          likes: node.edge_liked_by?.count ?? null,
          comments: node.edge_media_to_comment?.count ?? null,
        }));
    } catch {
      return [];
    }
  },
};

export const _unusedFirstMatch = firstMatch;
