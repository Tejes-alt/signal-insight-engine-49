import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Lock, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/metrics";
import { PlatformMark } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDashboard } from "@/hooks/use-dashboard";
import { createPublicSource, deleteSource, getSources, syncSource } from "@/lib/sources.functions";
import {
  CAPABILITY_LABELS,
  CAPABILITY_STATE_LABELS,
  PROVIDER_LIST,
  type CapabilityKey,
  type CapabilityState,
  type ProviderId,
} from "@/lib/providers/registry";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
  head: () => ({
    meta: [
      { title: "Accounts · Pulse Social Analytics" },
      {
        name: "description",
        content:
          "Connect your social accounts through each platform's official authorization flow. Pulse never asks for platform passwords.",
      },
      { property: "og:title", content: "Accounts · Pulse Social Analytics" },
      {
        property: "og:description",
        content: "Official OAuth connections only — no passwords are ever requested or stored.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const STATE_STYLE: Record<CapabilityState, string> = {
  available: "text-success",
  requires_authorization: "text-primary",
  requires_elevated_access: "text-warning",
  unsupported: "text-muted-foreground line-through decoration-muted-foreground/40",
};

function AccountsPage() {
  const { orgId, refetch } = useDashboard();
  const queryClient = useQueryClient();
  const sourcesFn = useServerFn(getSources);
  const createFn = useServerFn(createPublicSource);
  const syncFn = useServerFn(syncSource);
  const deleteFn = useServerFn(deleteSource);

  const [handles, setHandles] = useState<Partial<Record<ProviderId, string>>>({});

  const sourcesQuery = useQuery({
    queryKey: ["sources", orgId],
    queryFn: () => sourcesFn({ data: { orgId: orgId! } }),
    enabled: Boolean(orgId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["sources", orgId] });
    refetch();
  };

  const connect = useMutation({
    mutationFn: (vars: { provider: ProviderId; input: string }) =>
      createFn({ data: { orgId: orgId!, provider: vars.provider, input: vars.input } }),
    onSuccess: () => {
      toast.success("Account added", { description: "Fetching data from the platform's official API." });
      invalidate();
    },
    onError: (error: Error) => toast.error("Could not connect", { description: error.message }),
  });

  const sync = useMutation({
    mutationFn: (sourceId: string) => syncFn({ data: { orgId: orgId!, sourceId } }),
    onSuccess: () => {
      toast.success("Sync complete");
      invalidate();
    },
    onError: (error: Error) => toast.error("Sync failed", { description: error.message }),
  });

  const remove = useMutation({
    mutationFn: (sourceId: string) => deleteFn({ data: { orgId: orgId!, sourceId, deleteData: true } }),
    onSuccess: () => {
      toast.success("Account disconnected");
      invalidate();
    },
    onError: (error: Error) => toast.error("Could not disconnect", { description: error.message }),
  });

  const sources = sourcesQuery.data?.sources ?? [];
  const runtime = sourcesQuery.data?.runtime ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Accounts"
        description="Connect each platform through its own official authorization flow."
      />

      <div className="panel gradient-border animate-rise mb-6 flex items-start gap-4 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className="font-display font-semibold">We never ask for your social passwords</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Pulse only uses each platform's official API and OAuth authorization screens. Access tokens are stored
            server-side, encrypted, and can be revoked at any time from the platform itself. If a platform's API does
            not expose a metric, the dashboard says so instead of estimating it.
          </p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Connected</h2>
        {sourcesQuery.isLoading ? (
          <div className="skeleton h-24" />
        ) : sources.length === 0 ? (
          <EmptyState
            title="No accounts connected"
            body="Add a platform below. Until then, demo mode shows what the dashboard looks like with data."
            icon={<Lock className="size-5" />}
          />
        ) : (
          <div className="stagger grid gap-4 md:grid-cols-2">
            {sources.map((source) => (
              <article key={source.id} className="panel panel-hover flex items-center gap-3 p-4">
                <PlatformMark provider={source.provider as ProviderId} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{source.displayName ?? source.handle ?? source.externalId}</p>
                  <p className="label-mono truncate">
                    {source.syncStatus}
                    {source.lastSyncedAt ? ` · synced ${new Date(source.lastSyncedAt).toLocaleString()}` : ""}
                  </p>
                  {source.lastError ? (
                    <p className="mt-1 text-xs text-destructive">{source.lastError}</p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => sync.mutate(source.id)}
                  disabled={sync.isPending}
                  aria-label="Sync now"
                >
                  <RefreshCw className={cn("size-4", sync.isPending && "animate-spin")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove.mutate(source.id)}
                  disabled={remove.isPending}
                  aria-label="Disconnect"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Available platforms</h2>
        <div className="stagger grid gap-4 lg:grid-cols-2">
          {PROVIDER_LIST.map((provider) => {
            const status = runtime.find((r) => r.id === provider.id);
            const publicReady = status?.publicModeReady ?? false;
            const oauthReady = status?.oauthReady ?? false;
            return (
              <article key={provider.id} className="panel panel-hover p-5">
                <div className="flex items-start gap-3">
                  <PlatformMark provider={provider.id} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-semibold">{provider.name}</h3>
                    <p className="text-xs text-muted-foreground">{provider.tagline}</p>
                  </div>
                  {oauthReady ? (
                    <span className="label-mono flex items-center gap-1 text-success">
                      <CheckCircle2 className="size-3.5" /> OAuth ready
                    </span>
                  ) : (
                    <span className="label-mono">Setup required</span>
                  )}
                </div>

                {publicReady ? (
                  <form
                    className="mt-4 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const value = (handles[provider.id] ?? "").trim();
                      if (value.length < 2) return;
                      connect.mutate({ provider: provider.id, input: value });
                    }}
                  >
                    <Input
                      value={handles[provider.id] ?? ""}
                      onChange={(e) => setHandles((h) => ({ ...h, [provider.id]: e.target.value }))}
                      placeholder={provider.modes.public.inputPlaceholder}
                      aria-label={provider.modes.public.inputLabel}
                    />
                    <Button type="submit" disabled={connect.isPending}>
                      {connect.isPending ? <Loader2 className="size-4 animate-spin" /> : "Add"}
                    </Button>
                  </form>
                ) : (
                  <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Connecting {provider.name} requires app credentials for its official API
                      {provider.modes.oauth.requiredEnv.length > 0
                        ? ` (${provider.modes.oauth.requiredEnv.join(", ")})`
                        : ""}
                      . Once those are configured, the Connect button opens {provider.name}'s own authorization screen —
                      you'll never type your {provider.name} password here.
                    </p>
                    <Button className="mt-3" variant="outline" size="sm" disabled>
                      Connect {provider.name}
                    </Button>
                  </div>
                )}

                <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3">
                  {(Object.keys(provider.capabilities) as CapabilityKey[]).slice(0, 8).map((key) => {
                    const state = provider.capabilities[key];
                    return (
                      <li key={key}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn("cursor-help text-xs font-medium", STATE_STYLE[state])}>
                              {CAPABILITY_LABELS[key]}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{CAPABILITY_STATE_LABELS[state]}</TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
