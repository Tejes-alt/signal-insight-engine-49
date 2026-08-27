/**
 * Persistence for manually entered and imported measurements.
 *
 * Every row written here carries its provenance (`manual`, `import`,
 * `screenshot` or `public`) so the app can always tell the person where a
 * number came from.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetricField } from "./schema";

type DB = SupabaseClient<any, any, any>;

export type EntrySource = "manual" | "import" | "screenshot";

export interface MetricEntry {
  capturedAt: string;
  metrics: Partial<Record<MetricField, number>>;
}

export interface ContentEntry {
  externalId: string;
  title: string | null;
  url: string | null;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  reach: number | null;
  impressions: number | null;
  saves: number | null;
}

function snapshotPayload(
  accountId: string,
  orgId: string,
  entry: MetricEntry,
  source: EntrySource,
  importId: string | null,
) {
  const m = entry.metrics;
  return {
    account_id: accountId,
    org_id: orgId,
    captured_at: entry.capturedAt,
    followers: m.followers ?? null,
    following: m.following ?? null,
    posts: m.posts ?? null,
    views: m.views ?? null,
    likes: m.likes ?? null,
    comments: m.comments ?? null,
    shares: m.shares ?? null,
    saves: m.saves ?? null,
    reach: m.reach ?? null,
    impressions: m.impressions ?? null,
    profile_visits: m.profile_visits ?? null,
    source,
    import_id: importId,
  };
}

/** Rejects a second measurement for the same account on the same day. */
export async function findDuplicateDays(
  db: DB,
  accountId: string,
  days: string[],
): Promise<Set<string>> {
  if (!days.length) return new Set();
  const sorted = [...days].sort();
  const { data } = await db
    .from("account_snapshots")
    .select("captured_at")
    .eq("account_id", accountId)
    .gte("captured_at", `${sorted[0]!.slice(0, 10)}T00:00:00.000Z`)
    .lte("captured_at", `${sorted[sorted.length - 1]!.slice(0, 10)}T23:59:59.999Z`);
  return new Set((data ?? []).map((row: { captured_at: string }) => row.captured_at.slice(0, 10)));
}

export async function saveSnapshot(
  db: DB,
  orgId: string,
  accountId: string,
  entry: MetricEntry,
  source: EntrySource,
): Promise<{ saved: boolean; reason?: string }> {
  const existing = await findDuplicateDays(db, accountId, [entry.capturedAt]);
  if (existing.has(entry.capturedAt.slice(0, 10))) {
    return { saved: false, reason: "There's already a measurement saved for that date." };
  }
  const { error } = await db.from("account_snapshots").insert(snapshotPayload(accountId, orgId, entry, source, null));
  if (error) throw new Error("We couldn't save that measurement. Please try again.");
  await db.from("public_accounts").update({ status: "available", status_reason: null }).eq("id", accountId).eq("org_id", orgId);
  return { saved: true };
}

export async function deleteSnapshot(db: DB, orgId: string, snapshotId: string) {
  await db.from("account_snapshots").delete().eq("id", snapshotId).eq("org_id", orgId);
}

export interface ImportPayload {
  orgId: string;
  userId: string;
  accountId: string;
  platform: string;
  fileName: string;
  fileType: string;
  entries: MetricEntry[];
  content: ContentEntry[];
}

/** Writes an import as one auditable batch that can be undone in full. */
export async function commitImport(db: DB, payload: ImportPayload) {
  const { data: importRow, error: importError } = await db
    .from("imports")
    .insert({
      org_id: payload.orgId,
      account_id: payload.accountId,
      platform: payload.platform,
      file_name: payload.fileName,
      file_type: payload.fileType,
      source: "import",
      status: "processing",
      created_by: payload.userId,
    })
    .select("id")
    .single();
  if (importError || !importRow) throw new Error("We couldn't start that import. Please try again.");

  const importId = importRow.id as string;
  const dedupe = await findDuplicateDays(
    db,
    payload.accountId,
    payload.entries.map((e) => e.capturedAt),
  );

  const seen = new Set<string>();
  const rows: ReturnType<typeof snapshotPayload>[] = [];
  let skipped = 0;
  for (const entry of payload.entries) {
    const day = entry.capturedAt.slice(0, 10);
    if (dedupe.has(day) || seen.has(day)) {
      skipped += 1;
      continue;
    }
    seen.add(day);
    rows.push(snapshotPayload(payload.accountId, payload.orgId, entry, "import", importId));
  }

  if (rows.length) {
    const { error } = await db.from("account_snapshots").insert(rows);
    if (error) throw new Error("We couldn't save those measurements. Please try again.");
  }

  let contentSaved = 0;
  if (payload.content.length) {
    const { error } = await db.from("public_content").upsert(
      payload.content.map((item) => ({
        account_id: payload.accountId,
        org_id: payload.orgId,
        external_id: item.externalId,
        title: item.title,
        url: item.url,
        published_at: item.publishedAt,
        views: item.views,
        likes: item.likes,
        comments: item.comments,
        shares: item.shares,
        reach: item.reach,
        impressions: item.impressions,
        saves: item.saves,
        source: "import",
        import_id: importId,
        fetched_at: new Date().toISOString(),
      })),
      { onConflict: "account_id,external_id" },
    );
    if (!error) contentSaved = payload.content.length;
  }

  await db
    .from("imports")
    .update({
      status: "complete",
      row_count: payload.entries.length + payload.content.length,
      metric_count: rows.length,
      content_count: contentSaved,
      summary: { skipped_duplicates: skipped },
      completed_at: new Date().toISOString(),
    })
    .eq("id", importId);

  if (rows.length || contentSaved) {
    await db
      .from("public_accounts")
      .update({ status: "available", status_reason: null })
      .eq("id", payload.accountId)
      .eq("org_id", payload.orgId);
  }

  return { importId, measurements: rows.length, content: contentSaved, skipped };
}

export async function listImports(db: DB, orgId: string) {
  const { data } = await db
    .from("imports")
    .select("id, platform, file_name, file_type, status, row_count, metric_count, content_count, summary, created_at, account_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

/** Undo: removes an import together with everything it created. */
export async function undoImport(db: DB, orgId: string, importId: string) {
  await db.from("account_snapshots").delete().eq("org_id", orgId).eq("import_id", importId);
  await db.from("public_content").delete().eq("org_id", orgId).eq("import_id", importId);
  await db.from("imports").delete().eq("org_id", orgId).eq("id", importId);
}
