import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboard } from "@/hooks/use-dashboard";
import {
  completeConnection,
  disconnectAccount,
  startConnection,
  syncAccount,
} from "@/lib/social.functions";
import { PLATFORM_LIST, type PlatformId } from "@/lib/social/platforms";
import { CONNECTION_STATUS_LABELS, type ConnectionStatus } from "@/lib/social/model";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
  head: () => ({
    meta: [
      { title: "Connect your socials · SocialPulse" },
      {
        name: "description",
        content:
          "Connect your social accounts through each platform's official authorization flow. SocialPulse never asks for platform passwords.",
      },
      { property: "og:title", content: "Connect your socials · SocialPulse" },
      {
        property: "og:description",
        content: "Official authorization only — no social passwords are ever requested or stored.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const STEPS = [
  "Connecting your account…",
  "Fetching your analytics…",
  "Analyzing your content…",
  "Your dashboard is ready.",
];

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const seconds = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleString();
}

const STATUS_STYLE: Record<string, string> = {
  synced: "text-success",
  connected: "text-success",
  syncing: "text-primary",
  pending: "text-warning",
  needs_reconnect: "text-warning",
  permission_error: "text-destructive",
  unavailable: "text-destructive",
};

function AccountsPage() {
  const { orgId, connections, providerConfigured, linkingConfigured, refetch } = useDashboard();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const startFn = useServerFn(startConnection);
  const completeFn = useServerFn(completeConnection);
  const syncFn = useServerFn(syncAccount);
  const disconnectFn = useServerFn(disconnectAccount);

  const [handles, setHandles] = useState<Partial<Record<PlatformId, string>>>({});
  const [busy, setBusy] = useState<PlatformId | null>(null);
  const [failures, setFailures] = useState<Partial<Record<PlatformId, string>>>({});
  const [step, setStep] = useState<number | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["social", orgId] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    refetch();
  };

  // Return leg of the official authorization flow.
  useEffect(() => {
    if (!orgId) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("connected")) return;
    void (async () => {
      setStep(0);
      try {
        setStep(1);
        await completeFn({ data: { orgId } });
        setStep(2);
        invalidate();
        setStep(3);
        toast.success("Account connected");
        setTimeout(() => {
          setStep(null);
          void navigate({ to: "/dashboard" });
        }, 1200);
      } catch (error) {
        setStep(null);
        toast.error("We could not finish the connection", {
          description: error instanceof Error ? error.message : "Please try connecting again.",
        });
      } finally {
        window.history.replaceState({}, "", "/accounts");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const connect = useMutation({
    mutationFn: async (platform: PlatformId) => {
      const returnUrl = `${window.location.origin}/accounts?connected=1&platform=${platform}`;
      return startFn({
        data: {
          orgId: orgId!,
          platform,
          handle: handles[platform]?.trim() || null,
          returnUrl,
        },
      });
    },
    onMutate: (platform: PlatformId) => {
      setBusy(platform);
      setFailures((prev) => ({ ...prev, [platform]: undefined }));
    },
    onSuccess: ({ url }) => {
      // Hand off to the platform's own authorization screen.
      console.info("[connect] redirecting to provider authorization");
      window.location.href = url;
    },
    onError: (error: Error, platform: PlatformId) => {
      setBusy(null);
      console.error("[connect] failed", error);
      setFailures((prev) => ({ ...prev, [platform]: error.message }));
      toast.error("Connection failed", { description: error.message });
    },
  });

  const sync = useMutation({
    mutationFn: (connectionId: string) => syncFn({ data: { orgId: orgId!, connectionId } }),
    onSuccess: (outcome) => {
      if (outcome.ok) toast.success("Account synced");
      else toast.error("Sync failed", { description: outcome.error });
      invalidate();
    },
    onError: (error: Error) => toast.error("Sync failed", { description: error.message }),
  });

  const disconnect = useMutation({
    mutationFn: (vars: { connectionId: string; deleteData: boolean }) =>
      disconnectFn({ data: { orgId: orgId!, ...vars } }),
    onSuccess: () => {
      toast.success("Account disconnected");
      invalidate();
    },
    onError: (error: Error) => toast.error("Could not disconnect", { description: error.message }),
  });

  const byPlatform = new Map(connections.map((c) => [c.platform, c]));

  return (
    <AppShell>
      <PageHeader
        title="Connect your socials"
        description="Connect your accounts securely and bring all your analytics into one place."
      />

      {step !== null ? (
        <div className="panel gradient-border animate-rise mb-6 p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="font-display text-lg font-semibold">{STEPS[step]}</span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: "var(--gradient-brand)" }}
            />
          </div>
        </div>
      ) : null}

      <div className="panel animate-rise mb-6 flex items-start gap-4 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className="font-display font-semibold">We never ask for your social passwords</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Authorization always happens on the platform's own website. SocialPulse only receives the permissions you
            approve, tokens stay server-side, and you can disconnect any account at any time.
          </p>
        </div>
      </div>

      {!providerConfigured || !linkingConfigured ? (
        <div className="panel animate-rise mb-6 flex items-start gap-4 border-warning/40 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <h2 className="font-display font-semibold">Social integration setup required</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              The server-side credentials for the social integration provider are missing, so authorization cannot be
              started yet. Add AYRSHARE_API_KEY, AYRSHARE_DOMAIN and AYRSHARE_PRIVATE_KEY to the server secrets. Demo
              Mode stays fully available in the meantime.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PLATFORM_LIST.map((platform, index) => {
          const connection = byPlatform.get(platform.id);
          const status = (connection?.status ?? "pending") as ConnectionStatus;
          const isConnected = connection && (status === "connected" || status === "synced");
          return (
            <article
              key={platform.id}
              className="panel animate-rise group flex flex-col gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
              style={{ animationDelay: `${index * 35}ms` }}
            >
              <header className="flex items-start gap-3">
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-xl font-display text-sm font-bold"
                  style={{ background: `color-mix(in oklab, ${platform.accent} 18%, transparent)`, color: platform.accent }}
                >
                  {platform.mark}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display font-semibold">{platform.name}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{platform.description}</p>
                </div>
              </header>

              {isConnected ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-success" />
                    <span className="font-semibold text-success">{platform.name} Connected</span>
                    {connection?.handle ? (
                      <span className="truncate text-muted-foreground">
                        {platform.handlePrefix}
                        {connection.handle}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last synced {relativeTime(connection?.lastSyncedAt ?? null)}
                  </p>
                  {connection?.syncError ? (
                    <p className="text-xs text-destructive">{connection.syncError}</p>
                  ) : null}
                  <div className="mt-auto flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      disabled={sync.isPending}
                      onClick={() => sync.mutate(connection!.id)}
                    >
                      <RefreshCw className={cn("mr-1.5 size-3.5", sync.isPending && "animate-spin")} />
                      Sync now
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const deleteData = window.confirm(
                          `Disconnect ${platform.name}?\n\nThis removes SocialPulse's access to this account.\n\nOK — also delete the analytics already stored for it.\nCancel-then-confirm — keep the stored history.`,
                        );
                        disconnect.mutate({ connectionId: connection!.id, deleteData });
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="label-mono mb-1.5 block text-xs text-muted-foreground" htmlFor={`h-${platform.id}`}>
                      {platform.handleLabel}
                    </label>
                    <div className="flex items-center gap-2">
                      {platform.handlePrefix ? (
                        <span className="text-sm text-muted-foreground">{platform.handlePrefix}</span>
                      ) : null}
                      <Input
                        id={`h-${platform.id}`}
                        value={handles[platform.id] ?? ""}
                        placeholder={platform.handlePlaceholder}
                        onChange={(event) =>
                          setHandles((prev) => ({ ...prev, [platform.id]: event.target.value }))
                        }
                      />
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      A username alone only identifies the account. Connect {platform.name} to unlock your personal
                      analytics.
                    </p>
                  </div>
                  {connection && status !== "pending" ? (
                    <p className={cn("text-xs font-semibold", STATUS_STYLE[status])}>
                      {CONNECTION_STATUS_LABELS[status]}
                      {connection.syncError ? ` — ${connection.syncError}` : ""}
                    </p>
                  ) : null}
                  {failures[platform.id] ? (
                    <p className="text-xs leading-relaxed text-destructive">{failures[platform.id]}</p>
                  ) : null}
                  <Button
                    className="mt-auto w-full"
                    variant={failures[platform.id] ? "destructive" : "default"}
                    disabled={busy === platform.id}
                    onClick={() => connect.mutate(platform.id)}
                  >
                    {busy === platform.id ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : failures[platform.id] ? (
                      <AlertTriangle className="mr-2 size-4" />
                    ) : status === "needs_reconnect" ? (
                      <RefreshCw className="mr-2 size-4" />
                    ) : (
                      <Plus className="mr-2 size-4" />
                    )}
                    {busy === platform.id
                      ? "Connecting…"
                      : failures[platform.id]
                        ? "Connection Failed — Try Again"
                        : status === "needs_reconnect"
                          ? `Reconnect ${platform.name}`
                          : `Connect ${platform.name}`}
                    <ArrowRight className="ml-auto size-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </>
              )}
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
