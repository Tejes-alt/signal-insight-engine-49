/**
 * The universal provider registry. Server-only.
 *
 * Every platform is reached through this map — the connection engine never
 * special-cases a platform.
 */

import type { PlatformId } from "../platforms";
import { facebookProvider, instagramProvider } from "./providers/meta.server";
import { linkedinProvider } from "./providers/linkedin.server";
import { tiktokProvider } from "./providers/tiktok.server";
import { xProvider } from "./providers/x.server";
import { youtubeProvider } from "./providers/youtube.server";
import type { SocialProvider } from "./types";

export const PROVIDER_REGISTRY: Record<PlatformId, SocialProvider> = {
  youtube: youtubeProvider,
  instagram: instagramProvider,
  facebook: facebookProvider,
  linkedin: linkedinProvider,
  tiktok: tiktokProvider,
  twitter: xProvider,
};

export function providerFor(platform: string): SocialProvider {
  const provider = PROVIDER_REGISTRY[platform as PlatformId];
  if (!provider) throw new Error(`${platform} is not a supported platform.`);
  return provider;
}
