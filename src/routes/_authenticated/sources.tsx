import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { getWorkspace } from "@/lib/workspace.functions";
import {
  createPublicSource,
  deleteSource,
  getSources,
  patchSource,
  syncSource,
} from "@/lib/sources.functions";
import {
  CAPABILITY_LABELS,
  CAPABILITY_STATE_LABELS,
  PROVIDER_LIST,
  type ProviderId,
} from "@/lib/providers/registry";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sources")({
  head: () => ({
    meta: [
      { title: "Sources & providers — SENTINEX" },
      {
        name: "description",
        content:
          "Connect official platform APIs, review per-provider capabilities, and run real background synchronization for your intelligence workspace.",
      },
      { property: "og:title", content: "Sources & providers — SENTINEX" },
      {
        property: "og:description",
        content: "Manage official API connections powering SENTINEX intelligence.",
      },
    ],
  }),
  component: SourcesPage,
});

function SourcesPage() {
  const qc = useQueryClient();
  const workspaceFn = useServerFn(getWorkspace);
  const sourcesFn = useServerFn(getSources);
  const createFn = useServerFn(createPublicSource);
  const syncFn = useServerFn(syncSource);
  const patchFn = useServerFn(patchSource);
  const deleteFn = useServerFn(deleteSource);

  const ws = useQuery({ queryKey: ["workspace"], queryFn: () => workspaceFn({}) });
  const orgId = ws.data?.workspace.id;

  const sources = useQuery({
    queryKey: ["sources", orgId],
    enabled: Boolean(orgId),
    queryFn: () => sourcesFn({ data: { orgId: orgId! } }),
  });

  const [provider, setProvider] = useState<ProviderId>("youtube");
  const [input, setInput] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sources", orgId] });
    qc.invalidateQueries({ queryKey: ["intel"] });
  };

  const add = useMutation({
    mutationFn: () => createFn({ data: { orgId: orgId!, provider, input } }),
    onSuccess: (row) => {
      setInput("");
      toast.success(`Connected ${row.displayName ?? row.externalId}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: (vars: { sourceId: string; full?: boolean }) =>
      syncFn({ data: { orgId: orgId!, ...vars } }),
    onSuccess: (r) => {
      toast.success(`${r.newPosts} new · ${r.updatedPosts} refreshed · ${r.newComments} comments`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runtime = new Map((sources.data?.runtime ?? []).map((r) => [r.id, r]));

  return (
    <AppShell workspaceName={ws.data?.workspace.name ?? "…"} email={ws.data?.email ?? null}>
      <div className="mx-auto max-w-[1200px] space-y-5">
        <div>
          <div className="label-mono text-muted-foreground">Collection layer</div>
          <h1 className="font-display text-xl font-semibold text-foreground">Sources & providers</h1>
        </div>

        <div className="panel p-4">
          <div className="label-mono mb-3 text-muted-foreground">Add public source</div>
          <div className="flex flex-wrap gap-2">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderId)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {PROVIDER_LIST.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="@handle, channel URL or ID"
              className="min-w-[240px] flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-ring"
            />
            <button
              onClick={() => add.mutate()}
              disabled={!input || add.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {add.isPending ? "Resolving…" : "Connect"}
            </button>
          </div>
          {!runtime.get(provider)?.publicModeReady ? (
            <p className="mt-3 text-sm text-muted-foreground">
              This provider is not runnable yet in public mode
              {runtime.get(provider)?.missingEnv.length
                ? ` — missing credentials: ${runtime.get(provider)!.missingEnv.join(", ")}`
                : " — it requires an authorized account connection"}
              .
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          {(sources.data?.sources ?? []).map((s) => (
            <div key={s.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-display text-sm font-semibold text-foreground">
                    {s.displayName ?? s.externalId}
                  </div>
                  <div className="label-mono text-muted-foreground">
                    {s.provider} · {s.mode} · {s.handle ?? s.externalId}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "label-mono rounded border px-2 py-1",
                      s.status === "connected"
                        ? "border-primary/40 text-primary"
                        : "border-destructive/40 text-destructive",
                    )}
                  >
                    {s.syncStatus === "syncing" ? "syncing" : s.status}
                  </span>
                  <button
                    onClick={() => sync.mutate({ sourceId: s.id })}
                    disabled={sync.isPending}
                    className="label-mono rounded-md border border-border px-3 py-1.5 text-foreground hover:border-primary/50"
                  >
                    Sync
                  </button>
                  <button
                    onClick={() => sync.mutate({ sourceId: s.id, full: true })}
                    disabled={sync.isPending}
                    className="label-mono rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground"
                  >
                    Backfill
                  </button>
                  <button
                    onClick={() =>
                      patchFn({ data: { orgId: orgId!, sourceId: s.id, paused: !s.paused } }).then(
                        invalidate,
                      )
                    }
                    className="label-mono rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground"
                  >
                    {s.paused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm("Remove this source and its collected records?")) return;
                      deleteFn({ data: { orgId: orgId!, sourceId: s.id, deleteData: true } })
                        .then(invalidate)
                        .catch((e: Error) => toast.error(e.message));
                    }}
                    className="label-mono rounded-md border border-border px-3 py-1.5 text-destructive/80 hover:border-destructive/50"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="label-mono mt-3 flex flex-wrap gap-4 text-muted-foreground">
                <span>{s.recordsCollected} records</span>
                <span>
                  last sync {s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString() : "never"}
                </span>
                {s.followers !== null ? <span>{s.followers.toLocaleString()} followers</span> : null}
              </div>
              {s.lastError ? (
                <p className="mt-2 text-sm text-destructive">{s.lastError}</p>
              ) : null}
            </div>
          ))}
          {sources.data && sources.data.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sources connected yet.</p>
          ) : null}
        </div>

        <div className="panel p-4">
          <div className="label-mono mb-3 text-muted-foreground">Provider capability matrix</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="label-mono text-muted-foreground">
                  <th className="py-2 pr-4">Capability</th>
                  {PROVIDER_LIST.map((p) => (
                    <th key={p.id} className="py-2 pr-4">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(CAPABILITY_LABELS) as (keyof typeof CAPABILITY_LABELS)[]).map((cap) => (
                  <tr key={cap} className="border-t border-border/60">
                    <td className="py-2 pr-4 text-foreground">{CAPABILITY_LABELS[cap]}</td>
                    {PROVIDER_LIST.map((p) => {
                      const state = p.capabilities[cap];
                      return (
                        <td
                          key={p.id}
                          className={cn(
                            "label-mono py-2 pr-4",
                            state === "available" ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {CAPABILITY_STATE_LABELS[state]}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Capabilities reflect what each official API actually exposes. SENTINEX never
            approximates a metric a provider does not return.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
