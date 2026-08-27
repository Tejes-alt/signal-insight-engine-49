/**
 * Provider abstraction — capability metadata.
 *
 * Client-safe: contains no secrets and no network code. The runtime adapters
 * live in `src/lib/providers/*.server.ts` and are only reachable from server
 * functions.
 *
 * Capability values are deliberately honest about what each platform's official
 * API exposes. The UI renders these states verbatim instead of pretending.
 */

export type ProviderId = "youtube" | "x" | "tiktok" | "instagram";

export type CapabilityState =
  | "available" // works today with the configured credentials
  | "requires_authorization" // needs the account owner to complete OAuth
  | "requires_elevated_access" // needs a paid tier / platform approval
  | "unsupported"; // the provider's API does not expose this at all

export type CapabilityKey =
  | "profiles"
  | "posts"
  | "comments"
  | "likes"
  | "shares"
  | "views"
  | "followers"
  | "mentions"
  | "search"
  | "historical"
  | "webhooks";

export const CAPABILITY_LABELS: Record<CapabilityKey, string> = {
  profiles: "Profiles",
  posts: "Posts / uploads",
  comments: "Comments",
  likes: "Likes",
  shares: "Shares",
  views: "Views",
  followers: "Followers",
  mentions: "Mentions",
  search: "Search",
  historical: "Historical backfill",
  webhooks: "Webhooks / push",
};

export const CAPABILITY_STATE_LABELS: Record<CapabilityState, string> = {
  available: "Available",
  requires_authorization: "Requires authorization",
  requires_elevated_access: "Requires elevated access",
  unsupported: "Not supported by provider",
};

export type ConnectionMode = "public" | "oauth";

export interface ProviderDescriptor {
  id: ProviderId;
  name: string;
  /** Short mark rendered in the source cards. */
  mark: string;
  accent: string;
  tagline: string;
  /** Which connection modes this adapter implements today. */
  modes: {
    /** Add a public source by handle / URL, read through the official API. */
    public: {
      implemented: boolean;
      /** Server env var that must be present for this mode to work. */
      requiredEnv: string[];
      inputLabel: string;
      inputPlaceholder: string;
      helpText: string;
    };
    /** Full account connection through the platform's OAuth flow. */
    oauth: {
      implemented: boolean;
      requiredEnv: string[];
      scopes: string[];
      setupSteps: string[];
    };
  };
  capabilities: Record<CapabilityKey, CapabilityState>;
  /** Documented constraints surfaced in the provider status center. */
  notes: string[];
  docsUrl: string;
}

export const PROVIDERS: Record<ProviderId, ProviderDescriptor> = {
  youtube: {
    id: "youtube",
    name: "YouTube",
    mark: "YT",
    accent: "var(--color-chart-4)",
    tagline: "Channels, uploads, statistics and comment threads.",
    modes: {
      public: {
        implemented: true,
        requiredEnv: ["YOUTUBE_API_KEY"],
        inputLabel: "Channel handle, ID or URL",
        inputPlaceholder: "@nasa  ·  UCLA_DiR1FfKNvjuUpBHmylQ  ·  youtube.com/@nasa",
        helpText:
          "Resolved through the official YouTube Data API v3. Public channel metadata, uploads, public statistics and top-level comments are collected.",
      },
      oauth: {
        implemented: false,
        requiredEnv: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
        scopes: [
          "https://www.googleapis.com/auth/youtube.readonly",
          "https://www.googleapis.com/auth/yt-analytics.readonly",
        ],
        setupSteps: [
          "Create a project in the Google Cloud console and enable YouTube Data API v3 and YouTube Analytics API.",
          "Create an OAuth 2.0 Web client and add this app's callback URL as an authorized redirect URI.",
          "Store the client ID and secret as server secrets — they are never exposed to the browser.",
        ],
      },
    },
    capabilities: {
      profiles: "available",
      posts: "available",
      comments: "available",
      likes: "available",
      shares: "unsupported",
      views: "available",
      followers: "available",
      mentions: "unsupported",
      search: "available",
      historical: "available",
      webhooks: "requires_elevated_access",
    },
    notes: [
      "Public statistics only in public-source mode: dislike counts are not exposed by the API and are stored as null.",
      "Per-video demographic and revenue analytics require the channel owner to authorize YouTube Analytics.",
      "PubSubHubbub push notifications for new uploads require a publicly reachable callback URL.",
    ],
    docsUrl: "https://developers.google.com/youtube/v3/docs",
  },
  x: {
    id: "x",
    name: "X",
    mark: "X",
    accent: "var(--color-foreground)",
    tagline: "User timelines, mentions and public post metrics.",
    modes: {
      public: {
        implemented: false,
        requiredEnv: ["X_BEARER_TOKEN"],
        inputLabel: "Handle",
        inputPlaceholder: "@handle",
        helpText:
          "Requires an X API project with at least Basic access. App-only bearer tokens can read public user timelines.",
      },
      oauth: {
        implemented: false,
        requiredEnv: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
        scopes: ["tweet.read", "users.read", "offline.access"],
        setupSteps: [
          "Create an app in the X developer portal on a paid tier (free access cannot read timelines).",
          "Enable OAuth 2.0 with PKCE and register this app's callback URL.",
          "Store the client ID and secret as server secrets.",
        ],
      },
    },
    capabilities: {
      profiles: "requires_authorization",
      posts: "requires_elevated_access",
      comments: "requires_elevated_access",
      likes: "requires_elevated_access",
      shares: "requires_elevated_access",
      views: "requires_authorization",
      followers: "requires_elevated_access",
      mentions: "requires_elevated_access",
      search: "requires_elevated_access",
      historical: "requires_elevated_access",
      webhooks: "unsupported",
    },
    notes: [
      "X removed free timeline reads. Post and mention timelines need a paid API tier.",
      "Impression counts are only returned for posts owned by the authenticated user.",
    ],
    docsUrl: "https://docs.x.com/x-api",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    mark: "TT",
    accent: "var(--color-chart-5)",
    tagline: "Authorized creator profile and recent video performance.",
    modes: {
      public: {
        implemented: false,
        requiredEnv: [],
        inputLabel: "Username",
        inputPlaceholder: "@creator",
        helpText:
          "TikTok has no public read API. Data is only available for creators who authorize your app through the Display API.",
      },
      oauth: {
        implemented: false,
        requiredEnv: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
        scopes: ["user.info.basic", "user.info.stats", "video.list"],
        setupSteps: [
          "Register an app in the TikTok for Developers portal and add the Display API product.",
          "Submit the app for review — the video.list and user.info.stats scopes require approval.",
          "Register this app's redirect URI and store the client key and secret as server secrets.",
        ],
      },
    },
    capabilities: {
      profiles: "requires_authorization",
      posts: "requires_authorization",
      comments: "unsupported",
      likes: "requires_authorization",
      shares: "requires_authorization",
      views: "requires_authorization",
      followers: "requires_authorization",
      mentions: "unsupported",
      search: "unsupported",
      historical: "unsupported",
      webhooks: "requires_elevated_access",
    },
    notes: [
      "Only the authorizing creator's own videos are readable. There is no third-party or public lookup.",
      "Comment text is not exposed by the Display API — comment counts only.",
    ],
    docsUrl: "https://developers.tiktok.com/doc/display-api-overview",
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    mark: "IG",
    accent: "var(--color-chart-5)",
    tagline: "Business and creator accounts through the Meta Graph API.",
    modes: {
      public: {
        implemented: false,
        requiredEnv: [],
        inputLabel: "Username",
        inputPlaceholder: "@account",
        helpText:
          "Meta does not expose public profile reads. Only accounts that authorize your app, or business discovery from an authorized business account, are readable.",
      },
      oauth: {
        implemented: false,
        requiredEnv: ["META_APP_ID", "META_APP_SECRET"],
        scopes: [
          "instagram_basic",
          "instagram_manage_insights",
          "pages_show_list",
          "pages_read_engagement",
        ],
        setupSteps: [
          "Create a Meta app and add the Instagram Graph API product.",
          "Complete App Review for instagram_basic and instagram_manage_insights.",
          "Link an Instagram professional account to a Facebook Page, then store the app ID and secret as server secrets.",
        ],
      },
    },
    capabilities: {
      profiles: "requires_authorization",
      posts: "requires_authorization",
      comments: "requires_authorization",
      likes: "requires_authorization",
      shares: "requires_elevated_access",
      views: "requires_authorization",
      followers: "requires_authorization",
      mentions: "requires_authorization",
      search: "unsupported",
      historical: "requires_elevated_access",
      webhooks: "requires_authorization",
    },
    notes: [
      "Personal Instagram accounts cannot be analyzed — only Business and Creator accounts.",
      "App Review by Meta is mandatory before insights scopes work outside your own test accounts.",
    ],
    docsUrl: "https://developers.facebook.com/docs/instagram-platform",
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    mark: "in",
    accent: "var(--color-chart-2)",
    tagline: "Member and organization page performance through the Marketing API.",
    modes: {
      public: {
        implemented: false,
        requiredEnv: [],
        inputLabel: "Profile or page URL",
        inputPlaceholder: "linkedin.com/in/you  ·  linkedin.com/company/acme",
        helpText:
          "LinkedIn has no public read API. Analytics are only available for the member or page that authorizes your app.",
      },
      oauth: {
        implemented: false,
        requiredEnv: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
        scopes: ["r_basicprofile", "r_organization_social", "rw_organization_admin", "r_member_social"],
        setupSteps: [
          "Create an app in the LinkedIn Developer portal and associate it with a company page.",
          "Request the Community Management API product — member and page analytics scopes require approval.",
          "Register this app's redirect URL and store the client ID and secret as server secrets.",
        ],
      },
    },
    capabilities: {
      profiles: "requires_authorization",
      posts: "requires_authorization",
      comments: "requires_authorization",
      likes: "requires_authorization",
      shares: "requires_authorization",
      views: "requires_authorization",
      followers: "requires_authorization",
      mentions: "requires_elevated_access",
      search: "unsupported",
      historical: "requires_authorization",
      webhooks: "unsupported",
    },
    notes: [
      "Personal connection counts are not exposed by the API — follower counts are, for pages and creator profiles.",
      "Post impressions and profile views require the Community Management API product to be approved.",
    ],
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/",
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    mark: "f",
    accent: "var(--color-chart-1)",
    tagline: "Page insights, reach and post engagement through the Graph API.",
    modes: {
      public: {
        implemented: false,
        requiredEnv: [],
        inputLabel: "Page name or URL",
        inputPlaceholder: "facebook.com/yourpage",
        helpText:
          "Only Pages you administer can be analyzed, and only after the Page admin authorizes your app.",
      },
      oauth: {
        implemented: false,
        requiredEnv: ["META_APP_ID", "META_APP_SECRET"],
        scopes: ["pages_show_list", "pages_read_engagement", "read_insights"],
        setupSteps: [
          "Create a Meta app and add the Facebook Login and Pages API products.",
          "Complete App Review for pages_read_engagement and read_insights.",
          "Register this app's OAuth redirect URI and store the app ID and secret as server secrets.",
        ],
      },
    },
    capabilities: {
      profiles: "requires_authorization",
      posts: "requires_authorization",
      comments: "requires_authorization",
      likes: "requires_authorization",
      shares: "requires_authorization",
      views: "requires_authorization",
      followers: "requires_authorization",
      mentions: "requires_elevated_access",
      search: "unsupported",
      historical: "requires_authorization",
      webhooks: "requires_authorization",
    },
    notes: [
      "Personal Facebook profiles cannot be analyzed. The Graph API only exposes Pages.",
      "Organic reach metrics are aggregated by Meta and can lag by up to 48 hours.",
    ],
    docsUrl: "https://developers.facebook.com/docs/graph-api",
  },
};

export const PROVIDER_LIST = Object.values(PROVIDERS);

export function providerName(id: string): string {
  return PROVIDERS[id as ProviderId]?.name ?? id;
}
