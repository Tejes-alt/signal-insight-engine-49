import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertMember } from "./services/workspace.server";
import { PLATFORM_IDS, type PlatformId } from "./social/platforms";

const orgInput = z.object({ orgId: z.string().uuid() });
const platformEnum = z.enum(PLATFORM_IDS as [PlatformId, ...PlatformId[]]);

const metricsSchema = z.record(z.string(), z.number().int().min(0).max(100_000_000_000));

const entrySchema = z.object({
  capturedAt: z.string().min(4),
  metrics: metricsSchema,
});

const contentSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().nullable(),
  url: z.string().nullable(),
  publishedAt: z.string().nullable(),
  views: z.number().nullable(),
  likes: z.number().nullable(),
  comments: z.number().nullable(),
  shares: z.number().nullable(),
  reach: z.number().nullable(),
  impressions: z.number().nullable(),
  saves: z.number().nullable(),
});

/** Saves one measurement a person typed in themselves. */
export const saveManualSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgInput
      .extend({
        accountId: z.string().uuid(),
        source: z.enum(["manual", "screenshot"]),
        entry: entrySchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { saveSnapshot } = await import("./import/store.server");
    return saveSnapshot(context.supabase, data.orgId, data.accountId, data.entry as never, data.source);
  });

export const deleteSnapshotEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.extend({ snapshotId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { deleteSnapshot } = await import("./import/store.server");
    await deleteSnapshot(context.supabase, data.orgId, data.snapshotId);
    return { ok: true as const };
  });

/** Writes a confirmed file import as one reversible batch. */
export const commitFileImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgInput
      .extend({
        accountId: z.string().uuid(),
        platform: platformEnum,
        fileName: z.string().min(1).max(200),
        fileType: z.string().min(1).max(20),
        entries: z.array(entrySchema).max(5000),
        content: z.array(contentSchema).max(5000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { commitImport } = await import("./import/store.server");
    return commitImport(context.supabase, {
      orgId: data.orgId,
      userId: context.userId,
      accountId: data.accountId,
      platform: data.platform,
      fileName: data.fileName,
      fileType: data.fileType,
      entries: data.entries as never,
      content: data.content as never,
    });
  });

export const getImportHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { listImports } = await import("./import/store.server");
    return { imports: await listImports(context.supabase, data.orgId) };
  });

export const undoFileImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.extend({ importId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const { undoImport } = await import("./import/store.server");
    await undoImport(context.supabase, data.orgId, data.importId);
    return { ok: true as const };
  });

/**
 * Reads the numbers visible in an analytics screenshot so the person can check
 * and confirm them. Nothing is saved until they press save.
 */
export const readScreenshotMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ image: z.string().min(50).max(8_000_000), platform: platformEnum }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { metrics: {}, note: "Reading screenshots isn't available right now." };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You read social media analytics screenshots. Report ONLY numbers clearly visible in the image. Never estimate or invent a value. Expand abbreviations like 12.3K to 12300.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `This is a ${data.platform} analytics screenshot. Extract the visible metrics.` },
              { type: "image_url", image_url: { url: data.image } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_metrics",
              description: "Report metrics visible in the screenshot.",
              parameters: {
                type: "object",
                properties: {
                  followers: { type: "number" },
                  following: { type: "number" },
                  posts: { type: "number" },
                  views: { type: "number" },
                  likes: { type: "number" },
                  comments: { type: "number" },
                  shares: { type: "number" },
                  saves: { type: "number" },
                  reach: { type: "number" },
                  impressions: { type: "number" },
                  profile_visits: { type: "number" },
                  date: { type: "string", description: "ISO date shown in the screenshot, if any." },
                },
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_metrics" } },
      }),
    });

    if (!response.ok) {
      return {
        metrics: {},
        note:
          response.status === 429
            ? "Too many screenshots at once — try again in a minute."
            : "We couldn't read that screenshot. You can still type the numbers in.",
      };
    }

    const payload = (await response.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { metrics: {}, note: "No numbers were clearly visible in that screenshot." };

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(args) as Record<string, unknown>;
    } catch {
      return { metrics: {}, note: "We couldn't read that screenshot. You can still type the numbers in." };
    }

    const date = typeof parsed["date"] === "string" ? (parsed["date"] as string) : null;
    delete parsed["date"];
    const metrics: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) metrics[key] = Math.round(value);
    }
    return { metrics, date, note: null };
  });

/** Full export of everything stored for the workspace. */
export const exportWorkspaceData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.orgId, context.userId);
    const [{ data: accounts }, { data: snapshots }, { data: content }] = await Promise.all([
      context.supabase.from("public_accounts").select("*").eq("org_id", data.orgId),
      context.supabase.from("account_snapshots").select("*").eq("org_id", data.orgId).order("captured_at"),
      context.supabase.from("public_content").select("*").eq("org_id", data.orgId).order("published_at"),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      accounts: accounts ?? [],
      measurements: snapshots ?? [],
      content: content ?? [],
    };
  });
