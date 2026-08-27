/**
 * SocialPulse synchronization + analytics service. Server-only.
 *
 * Owns: connection lifecycle, real data synchronization through the official
 * platform providers, normalized persistence, historical recording, insight
 * generation and privacy/deletion actions.
 *
 * Nothing in here fabricates a number. When a platform does not return a
 * metric it is stored as absent and rendered with the reason.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { JsonObject } from "../json";
import {
  METRIC_KEYS,
  type ConnectionStatus,
  type MetricKey,
  type MetricStatus,
} from "../social/model";
import { PLATFORMS, platformName, type PlatformId } from "../social/platforms";
import { providerFor } from "../social/oauth/registry.server";
import { allIntegrationStatuses, integrationStatus } from "../social/oauth/config.server";
import { deleteTokens, loadTokens, usableToken } from "../social/oauth/tokens.server";
import {
  IntegrationNotConfiguredError,
  ProviderRequestError,
  type ProviderAccount,
} from "../social/oauth/types";
import {
  available,
  growthFromSeries,
  mergeSeries,
  sumMetrics,
  unavailable,
  type AnalyticsBundle,
  type ContentItem,
  type Insight,
  type PlatformSummary,
  type SeriesPoint,
} from "../analytics/dashboard";
import type { ProviderId } from "../providers/registry";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface StoredMetric {
  value: number | null;
  status: MetricStatus;
  reason?: string;
}

export type StoredMetrics = Partial<Record<MetricKey, StoredMetric>>;

export interface ConnectionRow {
  id: string;
  platform: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: ConnectionStatus;
  permissions: string[];
  syncStatus: string;
  syncError: string | null;
  lastSyncedAt: string | null;
  syncStartedAt: string | null;
  syncCompletedAt: string | null;
  createdAt: string;
  nextSyncAt: string | null;
  metrics: StoredMetrics;
}

/** The account identity stored on the connection row at authorization time. */
function accountFromRow(row: {
  external_id?: string | null;
  handle?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  metadata?: unknown;
}): ProviderAccount {
  return {
    externalId: row.external_id ?? "",
    handle: row.handle ?? null,
    displayName: row.display_name ?? null,
    avatarUrl: row.avatar_url ?? null,
    profileUrl: null,
    metadata: (row.metadata ?? {}) as JsonObject,
  };
}



/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export async function notify(
  orgId: string,
  kind: string,
  title: string,
  body: string | null,
  severity: "info" | "success" | "warning" | "error" = "info",
  data: JsonObject = {},
): Promise<void> {
  await supabaseAdmin.from("notifications").insert({
    org_id: orgId,
    kind,
    title,
    body,
    severity,
    data,
  });
}

/* ------------------------------------------------------------------ */
/* Connections                                                         */
/* ------------------------------------------------------------------ */

export async function listConnections(orgId: string): Promise<ConnectionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("social_connections")
    .select("*, social_metrics(metrics)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const metricRows = (row as unknown as { social_metrics?: { metrics: unknown }[] }).social_metrics ?? [];
    const metrics = (metricRows[0]?.metrics ?? {}) as StoredMetrics;
    return {
      id: row.id as string,
      platform: row.platform as string,
      handle: row.handle as string | null,
      displayName: row.display_name as string | null,
      avatarUrl: row.avatar_url as string | null,
      status: row.status as ConnectionStatus,
      permissions: Array.isArray(row.permissions) ? (row.permissions as string[]) : [],
      syncStatus: row.sync_status as string,
      syncError: row.sync_error as string | null,
      lastSyncedAt: row.last_synced_at as string | null,
      syncStartedAt: row.sync_started_at as string | null,
      syncCompletedAt: row.sync_completed_at as string | null,
      createdAt: row.created_at as string,
      nextSyncAt: (row as { next_sync_at?: string | null }).next_sync_at ?? null,
      metrics,

    };
  });
}

/**
 * Records the authorized account on the connection row. Called by the OAuth
 * callback once the platform itself has confirmed ownership.
 */
export async function upsertConnectedAccount(input: {
  orgId: string;
  userId: string;
  platform: PlatformId;
  account: ProviderAccount;
  scopes: string[];
  capabilities: MetricKey[];
}): Promise<ConnectionRow> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("social_connections").upsert(
    {
      org_id: input.orgId,
      user_id: input.userId,
      platform: input.platform,
      external_id: input.account.externalId,
      handle: input.account.handle,
      display_name: input.account.displayName,
      avatar_url: input.account.avatarUrl,
      metadata: input.account.metadata,
      permissions: input.scopes,
      scopes: input.scopes,
      capabilities: input.capabilities,
      status: "connected",
      sync_status: "idle",
      sync_error: null,
      sync_attempts: 0,
      connected_at: now,
      next_sync_at: now,
    },
    { onConflict: "org_id,platform" },
  );
  if (error) throw new Error(error.message);

  const created = (await listConnections(input.orgId)).find((c) => c.platform === input.platform);
  if (!created) throw new Error("The connection could not be stored.");
  return created;
}

/**
 * Reconciles stored connections against the credentials still held. A
 * connection whose credentials were revoked or deleted is marked as needing
 * reconnection rather than silently disappearing.
 */
export async function refreshConnectionStatuses(orgId: string): Promise<ConnectionRow[]> {
  const stored = await listConnections(orgId);
  for (const connection of stored) {
    if (connection.status === "needs_reconnect") continue;
    const token = await loadTokens(connection.id);
    if (!token) {
      await supabaseAdmin
        .from("social_connections")
        .update({ status: "needs_reconnect", sync_status: "idle" })
        .eq("id", connection.id);
    }
  }
  return listConnections(orgId);
}


/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

const FIELD_ALIASES: Record<MetricKey, string[]> = {
  followers: [
    "followersCount",
    "followerCount",
    "followers",
    "fanCount",
    "subscriberCount",
    "connectionsCount",
    "followedByCount",
  ],
  following: ["followsCount", "followingCount", "following"],
  views: ["viewsCount", "views", "totalViews", "viewCount", "pageViews"],
  reach: ["reach", "reachCount", "accountsReached"],
  impressions: ["impressions", "impressionsCount", "impressionCount"],
  likes: ["likeCount", "likesCount", "likes", "favoriteCount", "reactionsCount"],
  comments: ["commentsCount", "commentCount", "comments", "replyCount"],
  shares: ["shareCount", "sharesCount", "shares", "retweetCount", "repostCount"],
  saves: ["savedCount", "savesCount", "saves", "bookmarkCount"],
  engagement: ["engagementCount", "engagement", "totalEngagement"],
  engagementRate: ["engagementRate"],
  posts: ["mediaCount", "postsCount", "videoCount", "tweetCount", "statusesCount", "pinCount"],
  videoViews: ["videoViews", "videoViewCount", "playCount", "videoPlays"],
  profileViews: ["profileViews", "profileVisits", "profileViewCount"],
  watchTime: ["watchTimeMinutes", "estimatedMinutesWatched", "watchTime"],
  subscriberCount: ["subscriberCount", "subscribersCount"],
};

function readNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Number(raw);
  }
  return null;
}

function flatten(input: Record<string, unknown>, depth = 2): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value && typeof value === "object" && !Array.isArray(value) && depth > 0) {
      Object.assign(out, flatten(value as Record<string, unknown>, depth - 1));
    } else if (!(key in out)) {
      out[key] = value;
    }
  }
  return out;
}

/** Maps one platform's raw provider payload into the normalized metric set. */
export function normalizeAccountMetrics(
  platform: string,
  raw: Record<string, unknown>,
): StoredMetrics {
  const descriptor = PLATFORMS[platform as PlatformId];
  const flat = flatten(raw);
  const out: StoredMetrics = {};

  for (const key of METRIC_KEYS) {
    const supported = descriptor ? descriptor.metrics.includes(key) : true;
    if (!supported) {
      out[key] = {
        value: null,
        status: "not_supported",
        reason: `${platformName(platform)} does not report ${key} through its official API.`,
      };
      continue;
    }
    const value = readNumber(flat, FIELD_ALIASES[key]);
    out[key] =
      value === null
        ? {
            value: null,
            status: "unavailable",
            reason: `${platformName(platform)} did not return this figure for the connected account.`,
          }
        : { value, status: "available" };
  }

  // Derived engagement + rate, only when the inputs really exist.
  const parts = (["likes", "comments", "shares", "saves"] as MetricKey[])
    .map((k) => out[k])
    .filter((m): m is StoredMetric => Boolean(m && m.status === "available" && m.value !== null));
  if ((out["engagement"]?.value ?? null) === null && parts.length > 0) {
    out["engagement"] = { value: parts.reduce((a, m) => a + (m.value ?? 0), 0), status: "available" };
  }
  const denominator =
    out["reach"]?.value ?? out["impressions"]?.value ?? out["views"]?.value ?? out["videoViews"]?.value ?? null;
  const engagement = out["engagement"]?.value ?? null;
  if ((out["engagementRate"]?.value ?? null) === null) {
    out["engagementRate"] =
      engagement !== null && denominator !== null && denominator > 0
        ? { value: Number(((engagement / denominator) * 100).toFixed(2)), status: "available" }
        : {
            value: null,
            status: "unavailable",
            reason: "Needs both interactions and a reach or impression figure for this period.",
          };
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Synchronization                                                     */
/* ------------------------------------------------------------------ */

export interface SyncOutcome {
  platform: string;
  ok: boolean;
  error?: string;
  postsStored: number;
}

async function recordHistory(
  orgId: string,
  connectionId: string,
  platform: string,
  metricDate: string,
  metrics: StoredMetrics,
): Promise<void> {
  await supabaseAdmin
    .from("metric_history")
    .upsert(
      {
        org_id: orgId,
        connection_id: connectionId,
        platform,
        metric_date: metricDate,
        metrics: metrics as JsonObject,
      },
      { onConflict: "connection_id,metric_date" },
    );
}

async function logSync(input: {
  orgId: string;
  connectionId: string;
  platform: string;
  status: string;
  message: string | null;
  itemsSynced: number;
  durationMs: number;
}): Promise<void> {
  await supabaseAdmin.from("sync_logs").insert({
    org_id: input.orgId,
    connection_id: input.connectionId,
    platform: input.platform,
    status: input.status,
    message: input.message,
    items_synced: input.itemsSynced,
    duration_ms: input.durationMs,
  });
}

/**
 * Pulls live analytics for one connection straight from the platform's official
 * API and stores the normalized result, daily history and content performance.
 */
export async function syncConnection(orgId: string, connectionId: string): Promise<SyncOutcome> {
  const { data: row, error } = await supabaseAdmin
    .from("social_connections")
    .select("id, platform, org_id, external_id, handle, display_name, avatar_url, metadata")
    .eq("id", connectionId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("That connection does not exist in this workspace.");

  const platform = row.platform as string;
  const provider = providerFor(platform);
  const startedAt = Date.now();

  await supabaseAdmin
    .from("social_connections")
    .update({
      sync_status: "syncing",
      status: "syncing",
      sync_started_at: new Date(startedAt).toISOString(),
      sync_error: null,
    })
    .eq("id", connectionId);

  try {
    const token = await usableToken(provider, orgId, connectionId);
    const account = await provider.getAccount(token).catch(() => accountFromRow(row));

    // Keep the stored identity fresh — handles and avatars change.
    await supabaseAdmin
      .from("social_connections")
      .update({
        external_id: account.externalId || (row.external_id as string | null),
        handle: account.handle ?? (row.handle as string | null),
        display_name: account.displayName ?? (row.display_name as string | null),
        avatar_url: account.avatarUrl ?? (row.avatar_url as string | null),
      })
      .eq("id", connectionId);

    const analytics = await provider.getAnalytics(token, account);
    const metrics = analytics.metrics;

    await supabaseAdmin.from("social_metrics").upsert(
      {
        org_id: orgId,
        connection_id: connectionId,
        platform,
        captured_at: new Date().toISOString(),
        metrics: metrics as JsonObject,
      },
      { onConflict: "connection_id" },
    );

    const today = new Date().toISOString().slice(0, 10);
    await recordHistory(orgId, connectionId, platform, today, metrics);
    for (const point of analytics.history) {
      if (point.date === today) continue;
      await recordHistory(orgId, connectionId, platform, point.date, point.metrics);
    }

    let postsStored = 0;
    try {
      const items = await provider.getContent(token, account);
      const detailed = await provider.getContentAnalytics(token, account, items);
      for (const post of detailed) {
        const { data: saved, error: postError } = await supabaseAdmin
          .from("social_posts")
          .upsert(
            {
              org_id: orgId,
              connection_id: connectionId,
              platform,
              external_post_id: post.externalId,
              title: post.title,
              caption: post.caption,
              media_type: post.mediaType,
              thumbnail_url: post.thumbnailUrl,
              permalink: post.permalink,
              published_at: post.publishedAt,
            },
            { onConflict: "connection_id,external_post_id" },
          )
          .select("id")
          .single();
        if (postError || !saved) continue;
        await supabaseAdmin.from("post_metrics").upsert(
          {
            org_id: orgId,
            post_id: saved.id,
            captured_at: new Date().toISOString(),
            metrics: post.metrics as JsonObject,
          },
          { onConflict: "post_id" },
        );
        postsStored += 1;
      }
    } catch {
      // Content performance is optional — account analytics already succeeded.
    }

    const completedAt = new Date().toISOString();
    await supabaseAdmin
      .from("social_connections")
      .update({
        sync_status: "synced",
        status: "synced",
        sync_completed_at: completedAt,
        last_synced_at: completedAt,
        sync_error: null,
        sync_attempts: 0,
        next_sync_at: new Date(Date.now() + DEFAULT_SYNC_INTERVAL_MINUTES * 60_000).toISOString(),
      })
      .eq("id", connectionId);

    await logSync({
      orgId,
      connectionId,
      platform,
      status: "success",
      message: null,
      itemsSynced: postsStored,
      durationMs: Date.now() - startedAt,
    });
    await notify(orgId, "sync_completed", `${platformName(platform)} updated`, null, "success", { platform });
    return { platform, ok: true, postsStored };
  } catch (rawError) {
    const message =
      rawError instanceof IntegrationNotConfiguredError
        ? rawError.message
        : rawError instanceof Error
          ? rawError.message
          : "The synchronization failed.";
    const notAuthorized =
      rawError instanceof ProviderRequestError &&
      (rawError.code === "not_authorized" || rawError.status === 401);
    const rateLimited = rawError instanceof ProviderRequestError && rawError.code === "rate_limited";
    const status: ConnectionStatus = notAuthorized ? "permission_error" : "unavailable";
    // Exponential backoff so a failing account never hammers the platform API.
    const attempts = (await currentAttempts(connectionId)) + 1;
    const backoffMinutes = notAuthorized
      ? 24 * 60
      : Math.min(6 * 60, (rateLimited ? 30 : 10) * 2 ** Math.min(attempts - 1, 4));
    await supabaseAdmin
      .from("social_connections")
      .update({
        sync_status: "error",
        status,
        sync_error: message,
        sync_completed_at: new Date().toISOString(),
        sync_attempts: attempts,
        next_sync_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
      })
      .eq("id", connectionId);
    await logSync({
      orgId,
      connectionId,
      platform,
      status: "error",
      message,
      itemsSynced: 0,
      durationMs: Date.now() - startedAt,
    });
    await notify(orgId, "sync_failed", `${platformName(platform)} sync failed`, message, "error", { platform });
    return { platform, ok: false, error: message, postsStored: 0 };
  }
}


/** How often a healthy connection refreshes itself in the background. */
export const DEFAULT_SYNC_INTERVAL_MINUTES = 180;

async function currentAttempts(connectionId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("social_connections")
    .select("sync_attempts")
    .eq("id", connectionId)
    .maybeSingle();
  return Number((data as { sync_attempts?: number } | null)?.sync_attempts ?? 0);
}

export async function syncAll(orgId: string): Promise<SyncOutcome[]> {
  const connections = await listConnections(orgId);
  const targets = connections.filter((c) => c.status !== "needs_reconnect");
  const outcomes: SyncOutcome[] = [];
  for (const connection of targets) {
    outcomes.push(await syncConnection(orgId, connection.id));
  }
  if (outcomes.length > 0) await generateInsights(orgId, 30);
  return outcomes;
}

/** Refreshes only the connections in this workspace whose schedule has elapsed. */
export async function syncStale(orgId: string): Promise<SyncOutcome[]> {
  const now = Date.now();
  const due = (await listConnections(orgId)).filter(
    (c) =>
      c.status !== "needs_reconnect" && (!c.nextSyncAt || Date.parse(c.nextSyncAt) <= now),
  );
  const outcomes: SyncOutcome[] = [];
  for (const connection of due) outcomes.push(await syncConnection(orgId, connection.id));
  if (outcomes.length > 0) await generateInsights(orgId, 30);
  return outcomes;
}

/**
 * Background pass across every workspace: only connections whose `next_sync_at`
 * has elapsed are refreshed, so platform quota is spent on stale data only.
 */
export async function syncDueConnections(limit = 25): Promise<{
  scanned: number;
  synced: number;
  failed: number;
}> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("social_connections")
    .select("id, org_id, next_sync_at, status")
    .neq("status", "needs_reconnect")
    .or(`next_sync_at.is.null,next_sync_at.lte.${nowIso}`)
    .order("next_sync_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { id: string; org_id: string }[];
  let synced = 0;
  let failed = 0;
  const touchedOrgs = new Set<string>();
  for (const row of rows) {
    const outcome = await syncConnection(row.org_id, row.id);
    touchedOrgs.add(row.org_id);
    if (outcome.ok) synced += 1;
    else failed += 1;
  }
  for (const orgId of touchedOrgs) {
    try {
      await generateInsights(orgId, 30);
    } catch {
      // Insight generation is derived data; a failure never fails the sweep.
    }
  }
  return { scanned: rows.length, synced, failed };
}

/* ------------------------------------------------------------------ */
/* Account discovery                                                   */
/* ------------------------------------------------------------------ */

/**
 * Records a *possible* public account for a handle the user typed. Nothing here
 * proves ownership — only completing authorization does that.
 */
export async function discoverForWorkspace(
  orgId: string,
  userId: string,
  platform: PlatformId,
  handle: string,
): Promise<{ found: boolean; account: null | Record<string, unknown> }> {
  const provider = providerFor(platform);
  const cleaned = handle.replace(/^@/, "").trim();
  let discovered = null;
  try {
    discovered = await provider.discoverAccount({ handle: cleaned });
  } catch {
    discovered = null;
  }
  if (!discovered) return { found: false, account: null };

  await supabaseAdmin.from("discovered_accounts").upsert(
    {
      org_id: orgId,
      user_id: userId,
      platform,
      handle: discovered.handle,
      display_name: discovered.displayName,
      avatar_url: discovered.avatarUrl,
      profile_url: discovered.profileUrl,
      source: discovered.source,
      confidence: discovered.confidence,
      dismissed: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,platform" },
  );
  return { found: true, account: discovered as unknown as Record<string, unknown> };
}

/* ------------------------------------------------------------------ */
/* Disconnect + deletion                                               */
/* ------------------------------------------------------------------ */

export async function disconnectConnection(
  orgId: string,
  connectionId: string,
  deleteData: boolean,
): Promise<void> {
  const { data: row } = await supabaseAdmin
    .from("social_connections")
    .select("id, platform")
    .eq("id", connectionId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!row) throw new Error("That connection does not exist in this workspace.");

  const platform = row.platform as string;
  // Revoke at the platform first, then destroy the stored credential.
  try {
    const token = await loadTokens(connectionId);
    if (token) await providerFor(platform).disconnect(token);
  } catch {
    // The local credential is destroyed regardless of what the platform says.
  }
  await deleteTokens(connectionId);

  if (deleteData) {
    await supabaseAdmin.from("social_connections").delete().eq("id", connectionId);
  } else {
    await supabaseAdmin
      .from("social_connections")
      .update({ status: "needs_reconnect", sync_status: "idle", next_sync_at: null })
      .eq("id", connectionId);
  }
  await notify(
    orgId,
    "account_disconnected",
    `${platformName(platform)} disconnected`,
    deleteData ? "Stored analytics for this account were deleted." : "Stored analytics were kept.",
    "warning",
    { platform },
  );
}

export async function deleteWorkspaceAnalytics(orgId: string): Promise<void> {
  await supabaseAdmin.from("post_metrics").delete().eq("org_id", orgId);
  await supabaseAdmin.from("social_posts").delete().eq("org_id", orgId);
  await supabaseAdmin.from("metric_history").delete().eq("org_id", orgId);
  await supabaseAdmin.from("social_metrics").delete().eq("org_id", orgId);
  await supabaseAdmin.from("insights").delete().eq("org_id", orgId);
  await supabaseAdmin.from("sync_logs").delete().eq("org_id", orgId);
}

export async function deleteEverything(orgId: string): Promise<void> {
  const connections = await listConnections(orgId);
  for (const connection of connections) {
    try {
      await disconnectConnection(orgId, connection.id, true);
    } catch {
      await supabaseAdmin.from("social_connections").delete().eq("id", connection.id);
    }
  }
  await deleteWorkspaceAnalytics(orgId);
  await supabaseAdmin.from("discovered_accounts").delete().eq("org_id", orgId);
  await supabaseAdmin.from("oauth_states").delete().eq("org_id", orgId);
  await supabaseAdmin.from("notifications").delete().eq("org_id", orgId);
}


/* ------------------------------------------------------------------ */
/* Dashboard bundle from stored data                                   */
/* ------------------------------------------------------------------ */

const metricOf = (metrics: StoredMetrics, key: MetricKey, platform: string) => {
  const stored = metrics[key];
  if (stored && stored.status === "available" && stored.value !== null) return available(stored.value);
  return unavailable(
    stored?.reason ??
      (stored?.status === "not_supported"
        ? `${platformName(platform)} does not report this metric.`
        : "Not collected yet — run a sync for this account."),
  );
};

export async function buildRealBundle(orgId: string, rangeDays: number): Promise<AnalyticsBundle> {
  const connections = await listConnections(orgId);
  const since = new Date(Date.now() - rangeDays * 86400000).toISOString().slice(0, 10);

  const { data: historyRows } = await supabaseAdmin
    .from("metric_history")
    .select("connection_id, platform, metric_date, metrics")
    .eq("org_id", orgId)
    .gte("metric_date", since)
    .order("metric_date", { ascending: true });

  const historyByConnection = new Map<string, { date: string; metrics: StoredMetrics }[]>();
  for (const row of historyRows ?? []) {
    const list = historyByConnection.get(row.connection_id as string) ?? [];
    list.push({ date: row.metric_date as string, metrics: (row.metrics ?? {}) as StoredMetrics });
    historyByConnection.set(row.connection_id as string, list);
  }

  const { data: postRows } = await supabaseAdmin
    .from("social_posts")
    .select("id, platform, title, caption, thumbnail_url, permalink, published_at, post_metrics(metrics)")
    .eq("org_id", orgId)
    .gte("published_at", new Date(Date.now() - rangeDays * 86400000).toISOString())
    .order("published_at", { ascending: false })
    .limit(500);

  const platforms: PlatformSummary[] = connections.map((connection) => {
    const history = historyByConnection.get(connection.id) ?? [];
    const series: SeriesPoint[] = history.map((point) => ({
      date: point.date,
      followers: point.metrics.followers?.value ?? point.metrics.subscriberCount?.value ?? null,
      views: point.metrics.views?.value ?? point.metrics.videoViews?.value ?? null,
      engagement: point.metrics.engagement?.value ?? null,
      reach: point.metrics.reach?.value ?? null,
      posts: point.metrics.posts?.value ?? null,
    }));

    const descriptor = PLATFORMS[connection.platform as PlatformId];
    const extras = (["saves", "profileViews", "watchTime", "subscriberCount"] as MetricKey[])
      .filter((key) => descriptor?.metrics.includes(key))
      .map((key) => ({
        label:
          key === "saves"
            ? "Saves"
            : key === "profileViews"
              ? "Profile views"
              : key === "watchTime"
                ? "Watch time (min)"
                : "Subscribers",
        metric: metricOf(connection.metrics, key, connection.platform),
        format: "number" as const,
      }));

    return {
      provider: connection.platform as ProviderId,
      accountId: connection.id,
      name: connection.displayName ?? connection.handle ?? platformName(connection.platform),
      handle: connection.handle,
      displayName: connection.displayName,
      avatarUrl: connection.avatarUrl,
      connected: connection.status === "connected" || connection.status === "synced",
      lastSyncedAt: connection.lastSyncedAt,
      followers: metricOf(connection.metrics, "followers", connection.platform),
      views: metricOf(connection.metrics, "views", connection.platform),
      engagement: metricOf(connection.metrics, "engagement", connection.platform),
      reach: metricOf(connection.metrics, "reach", connection.platform),
      impressions: metricOf(connection.metrics, "impressions", connection.platform),
      posts: metricOf(connection.metrics, "posts", connection.platform),
      engagementRate: metricOf(connection.metrics, "engagementRate", connection.platform),
      growth: growthFromSeries(series, "followers"),
      extras,
      series,
    };
  });

  const content: ContentItem[] = (postRows ?? []).map((row) => {
    const metricRows = (row as unknown as { post_metrics?: { metrics: unknown }[] }).post_metrics ?? [];
    const metrics = (metricRows[0]?.metrics ?? {}) as StoredMetrics;
    const platform = row.platform as string;
    return {
      id: row.id as string,
      provider: platform as ProviderId,
      title: (row.title as string | null) ?? (row.caption as string | null) ?? "Untitled",
      thumbnailUrl: row.thumbnail_url as string | null,
      permalink: row.permalink as string | null,
      publishedAt: row.published_at as string,
      views: metricOf(metrics, "views", platform),
      likes: metricOf(metrics, "likes", platform),
      comments: metricOf(metrics, "comments", platform),
      shares: metricOf(metrics, "shares", platform),
      engagementRate: metricOf(metrics, "engagementRate", platform),
    };
  });

  const series = mergeSeries(platforms.map((p) => p.series));
  const views = sumMetrics(platforms.map((p) => p.views), "No connected platform reported views yet.");
  const engagement = sumMetrics(
    platforms.map((p) => p.engagement),
    "No engagement data has been collected yet.",
  );
  const rate =
    views.value && views.value > 0 && engagement.value !== null
      ? available(Number(((engagement.value / views.value) * 100).toFixed(2)))
      : unavailable("Engagement rate needs both interactions and views.");

  return {
    demo: false,
    generatedAt: new Date().toISOString(),
    rangeDays,
    platforms,
    totals: {
      reach: sumMetrics(platforms.map((p) => p.reach), "No connected platform reports reach."),
      followers: sumMetrics(platforms.map((p) => p.followers), "No follower data collected yet."),
      engagement,
      engagementRate: rate,
      views,
      published: available(content.length),
      growth: growthFromSeries(series, "followers"),
    },
    series,
    content,
    insights: await loadInsightCards(orgId),
  };
}

/* ------------------------------------------------------------------ */
/* Insights                                                            */
/* ------------------------------------------------------------------ */

export interface InsightRecord {
  id: string;
  category: string;
  title: string;
  body: string;
  tone: "positive" | "neutral" | "warning";
  metricLabel: string | null;
  metricValue: string | null;
  recommendation: string | null;
  windowDays: number;
  generatedAt: string;
}

async function loadInsightCards(orgId: string): Promise<Insight[]> {
  const records = await listInsights(orgId);
  return records.map((record) => ({
    id: record.id,
    title: record.title,
    body: record.body,
    tone: record.tone,
    evidence: [record.metricLabel, record.metricValue].filter(Boolean).join(": ") || "Derived from your stored analytics.",
  }));
}

export async function listInsights(orgId: string): Promise<InsightRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("insights")
    .select("*")
    .eq("org_id", orgId)
    .order("generated_at", { ascending: false })
    .limit(24);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    category: row.category as string,
    title: row.title as string,
    body: row.body as string,
    tone: (row.tone as InsightRecord["tone"]) ?? "neutral",
    metricLabel: row.metric_label as string | null,
    metricValue: row.metric_value as string | null,
    recommendation: row.recommendation as string | null,
    windowDays: row.window_days as number,
    generatedAt: row.generated_at as string,
  }));
}

/**
 * Derives insights strictly from stored real metrics. When there is not enough
 * history for a statement, the statement is simply not produced.
 */
export async function generateInsights(orgId: string, windowDays: number): Promise<InsightRecord[]> {
  const bundle = await buildRealBundle(orgId, windowDays);
  const rows: Record<string, unknown>[] = [];

  const growth = bundle.totals.growth.d30 ?? bundle.totals.growth.d7;
  if (growth !== null && Number.isFinite(growth)) {
    rows.push({
      org_id: orgId,
      category: "growth",
      title:
        growth >= 0
          ? `Your audience grew ${growth.toFixed(1)}% over the last ${windowDays} days.`
          : `Your audience declined ${Math.abs(growth).toFixed(1)}% over the last ${windowDays} days.`,
      body: "Calculated from the follower counts recorded at each synchronization in this period.",
      tone: growth >= 0 ? "positive" : "warning",
      metric_label: "Follower change",
      metric_value: `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`,
      recommendation:
        growth >= 0
          ? "Keep publishing the formats that drove this period's growth."
          : "Review what changed in your posting cadence during this period.",
      window_days: windowDays,
      evidence: { source: "metric_history", metric: "followers" },
    });
  }

  const rated = bundle.platforms
    .filter((p) => p.engagementRate.state === "available" && p.engagementRate.value !== null)
    .sort((a, b) => (b.engagementRate.value ?? 0) - (a.engagementRate.value ?? 0));
  if (rated.length > 0) {
    const best = rated[0]!;
    rows.push({
      org_id: orgId,
      category: "engagement",
      title: `${platformName(best.provider)} currently has your strongest engagement rate.`,
      body: "Compared across every connected platform that reports both interactions and reach.",
      tone: "positive",
      metric_label: "Engagement rate",
      metric_value: `${(best.engagementRate.value ?? 0).toFixed(2)}%`,
      recommendation: `Prioritise ${platformName(best.provider)} while this advantage holds.`,
      window_days: windowDays,
      evidence: { source: "social_metrics", platform: best.provider },
    });
  }

  const withViews = bundle.content.filter((c) => c.views.state === "available" && c.views.value !== null);
  if (withViews.length >= 5) {
    const sorted = [...withViews].sort((a, b) => (b.views.value ?? 0) - (a.views.value ?? 0));
    const total = sorted.reduce((sum, c) => sum + (c.views.value ?? 0), 0);
    const topFive = sorted.slice(0, 5).reduce((sum, c) => sum + (c.views.value ?? 0), 0);
    if (total > 0) {
      const share = (topFive / total) * 100;
      rows.push({
        org_id: orgId,
        category: "content",
        title: `Your top 5 posts generated ${share.toFixed(0)}% of your total views.`,
        body: `Across ${sorted.length} posts published in the last ${windowDays} days.`,
        tone: "neutral",
        metric_label: "Top-5 share of views",
        metric_value: `${share.toFixed(0)}%`,
        recommendation: "Study what those five posts have in common and repeat the format.",
        window_days: windowDays,
        evidence: { source: "social_posts", sample: sorted.length },
      });
    }
  }

  await supabaseAdmin.from("insights").delete().eq("org_id", orgId);
  if (rows.length > 0) {
    await supabaseAdmin.from("insights").insert(rows as never);
    await notify(orgId, "insight_available", "New insights are ready", null, "info", {});
  }
  return listInsights(orgId);
}

/* ------------------------------------------------------------------ */
/* Setup / admin status                                                */
/* ------------------------------------------------------------------ */

export interface IntegrationSummary {
  platform: PlatformId;
  name: string;
  configured: boolean;
  missing: string[];
}

export interface SetupStatus {
  integrations: IntegrationSummary[];
  configuredCount: number;
  database: boolean;
  connections: number;
  backgroundSync: { enabled: boolean; due: number; nextSyncAt: string | null };
  analyticsReady: boolean;
  recentSyncs: { platform: string; status: string; at: string | null; error: string | null }[];
}

export async function setupStatus(orgId: string): Promise<SetupStatus> {
  const integrations: IntegrationSummary[] = allIntegrationStatuses().map((status) => ({
    platform: status.platform,
    name: platformName(status.platform),
    configured: status.configured,
    missing: status.missing,
  }));
  const connections = await listConnections(orgId);
  let database = true;
  try {
    await supabaseAdmin.from("organizations").select("id").eq("id", orgId).limit(1);
  } catch {
    database = false;
  }
  const now = Date.now();
  const active = connections.filter((c) => c.status !== "needs_reconnect");
  const schedule = active
    .map((c) => c.nextSyncAt)
    .filter((v): v is string => Boolean(v))
    .sort();

  return {
    integrations,
    configuredCount: integrations.filter((i) => i.configured).length,
    database,
    connections: connections.length,
    backgroundSync: {
      enabled: active.length > 0,
      due: active.filter((c) => !c.nextSyncAt || Date.parse(c.nextSyncAt) <= now).length,
      nextSyncAt: schedule[0] ?? null,
    },
    analyticsReady: connections.some((c) => c.lastSyncedAt !== null),
    recentSyncs: connections.map((c) => ({
      platform: c.platform,
      status: c.syncStatus,
      at: c.lastSyncedAt,
      error: c.syncError,
    })),
  };
}

/** Per-platform readiness for the connect UI. */
export function integrationReadiness(platform: PlatformId) {
  return integrationStatus(platform);
}

