import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboard } from "@/hooks/dashboard-context";
import {
  completeConnection,
  disconnectAccount,
  discoverAccount,
  startConnection,
  syncAccount,
} from "@/lib/social.functions";
import { PLATFORM_LIST, type PlatformDescriptor, type PlatformId } from "@/lib/social/platforms";
import { friendlyConnectionError, friendlySyncError, type FriendlyError } from "@/lib/social/user-messages";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
  head: () => ({
    meta: [
      { title: "Connect your socials · SocialPulse" },
      {
        name: "description",
        content:
          "Connect Instagram, YouTube, LinkedIn, TikTok, X and Facebook to see all of your personal analytics in one beautiful place.",
      },
      { property: "og:title", content: "Connect your socials · SocialPulse" },
      {
        property: "og:description",
        content: "One tap to connect. All of your social analytics, unified and always up to date.",
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
  if (!iso) return "just now";
  const seconds = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return "moments ago";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function compact(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

type CardState =
  | "not_connected"
  | "connecting"
  | "connected"
  | "needs_reconnection"
  | "syncing"
  | "error";

function AccountsPage() {
  const { orgId, connections, refetch } = useDashboard();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const startFn = useServerFn(startConnection);
  const completeFn = useServerFn(completeConnection);
  const syncFn = useServerFn(syncAccount);
  const disconnectFn = useServerFn(disconnectAccount);
  const discoverFn = useServerFn(discoverAccount);

  const [handles, setHandles] = useState<Partial<Record<PlatformId, string>>>({});
  const [busy, setBusy] = useState<PlatformId | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [failures, setFailures] = useState<Partial<Record<PlatformId, FriendlyError>>>({});
  const [expanded, setExpanded] = useState<Partial<Record<PlatformId, boolean>>>({});
  const [matches, setMatches] = useState<Partial<Record<PlatformId, string>>>({});
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
        const friendly = friendlyConnectionError(error, "This");
        toast.error("You're almost there", { description: friendly.details });
      } finally {
        window.history.replaceState({}, "", "/accounts");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // Gentle, optional discovery from the account handle the user typed.
  const tryDiscover = async (platform: PlatformId) => {
    const handle = handles[platform]?.trim();
    if (!orgId || !handle) return;
    try {
      const result = (await discoverFn({ data: { orgId, platform, handle } })) as
        | { handle?: string | null; displayName?: string | null }
        | null;
      const found = result?.handle ?? result?.displayName ?? null;
      if (found) setMatches((prev) => ({ ...prev, [platform]: found }));
    } catch {
      // Discovery is a convenience only — silence is correct here.
    }
  };

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
    onSuccess: (result, platform: PlatformId) => {
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setBusy(null);
      setFailures((prev) => ({
        ...prev,
        [platform]: {
          message: "You're almost there",
          details: "This connection isn't available yet. We'll let you know as soon as it is.",
        },
      }));
    },
    onError: (error: Error, platform: PlatformId) => {
      setBusy(null);
      const name = PLATFORM_LIST.find((p) => p.id === platform)?.name ?? "This";
      const friendly = friendlyConnectionError(error, name);
      setFailures((prev) => ({ ...prev, [platform]: friendly }));
      toast.error(friendly.message, { description: "Please try again in a moment." });
    },
  });

  const sync = useMutation({
    mutationFn: (vars: { connectionId: string; platform: PlatformId }) => {
      setSyncingId(vars.connectionId);
      return syncFn({ data: { orgId: orgId!, connectionId: vars.connectionId } });
    },
    onSuccess: (outcome, vars) => {
      setSyncingId(null);
      const name = PLATFORM_LIST.find((p) => p.id === vars.platform)?.name ?? "Account";
      if (outcome.ok) toast.success(`${name} is up to date`);
      else toast.error(friendlySyncError(outcome.error, name).message);
      invalidate();
    },
    onError: (error: Error, vars) => {
      setSyncingId(null);
      const name = PLATFORM_LIST.find((p) => p.id === vars.platform)?.name ?? "Account";
      toast.error(friendlySyncError(error, name).message);
    },
  });

  const disconnect = useMutation({
    mutationFn: (vars: { connectionId: string; deleteData: boolean }) =>
      disconnectFn({ data: { orgId: orgId!, ...vars } }),
    onSuccess: () => {
      toast.success("Account disconnected");
      invalidate();
    },
    onError: () => toast.error("We couldn't disconnect that account right now."),
  });

  const byPlatform = new Map(connections.map((c) => [c.platform, c]));

  return (
    <AppShell>
      <PageHeader
        title="Your accounts"
        description="Connect an account once — SocialPulse keeps your analytics fresh automatically."
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

      <div className="panel animate-rise mb-8 flex items-start gap-4 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className="font-display font-semibold">Sign in happens on the platform, never here</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            We never ask for your social passwords. You approve access on the platform's own site and can
            remove it whenever you like.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {PLATFORM_LIST.map((platform, index) => {
          const connection = byPlatform.get(platform.id);
          const status = connection?.status ?? "pending";
          const isConnected = status === "connected" || status === "synced";
          const isSyncing = Boolean(connection && syncingId === connection.id);
          const state: CardState = isSyncing
            ? "syncing"
            : isConnected
              ? "connected"
              : status === "needs_reconnect" || status === "permission_error"
                ? "needs_reconnection"
                : busy === platform.id
                  ? "connecting"
                  : failures[platform.id]
                    ? "error"
                    : "not_connected";

          return (
            <PlatformCard
              key={platform.id}
              platform={platform}
              index={index}
              state={state}
              handle={handles[platform.id] ?? ""}
              onHandleChange={(value) => setHandles((prev) => ({ ...prev, [platform.id]: value }))}
              onHandleBlur={() => void tryDiscover(platform.id)}
              match={matches[platform.id] ?? null}
              failure={failures[platform.id] ?? null}
              expanded={Boolean(expanded[platform.id])}
              onToggleDetails={() =>
                setExpanded((prev) => ({ ...prev, [platform.id]: !prev[platform.id] }))
              }
              followers={
                (connection?.metrics?.["followers"]?.value ??
                  connection?.metrics?.["subscriberCount"]?.value ??
                  null) as number | null
              }
              connectedHandle={connection?.handle ?? connection?.displayName ?? null}
              lastSyncedAt={connection?.lastSyncedAt ?? null}
              disabled={!orgId}
              onConnect={() => connect.mutate(platform.id)}
              onSync={() =>
                connection && sync.mutate({ connectionId: connection.id, platform: platform.id })
              }
              onDisconnect={() => {
                if (!connection) return;
                const deleteData = window.confirm(
                  `Disconnect ${platform.name}?\n\nOK — also remove the analytics we've stored.\nCancel — keep your history.`,
                );
                disconnect.mutate({ connectionId: connection.id, deleteData });
              }}
            />
          );
        })}
      </div>
    </AppShell>
  );
}

interface CardProps {
  platform: PlatformDescriptor;
  index: number;
  state: CardState;
  handle: string;
  onHandleChange: (value: string) => void;
  onHandleBlur: () => void;
  match: string | null;
  failure: FriendlyError | null;
  expanded: boolean;
  onToggleDetails: () => void;
  followers: number | null;
  connectedHandle: string | null;
  lastSyncedAt: string | null;
  disabled: boolean;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}

function PlatformCard(props: CardProps) {
  const { platform, state } = props;
  const busy = state === "connecting" || state === "syncing";

  return (
    <article
      className="panel animate-rise group relative flex flex-col gap-5 overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
      style={{ animationDelay: `${props.index * 45}ms` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-45"
        style={{ background: platform.accent }}
      />

      <header className="relative flex items-start gap-4">
        <span
          className="grid size-14 shrink-0 place-items-center rounded-2xl font-display text-lg font-bold shadow-[var(--shadow-soft)] transition-transform duration-300 group-hover:scale-105"
          style={{
            background: `color-mix(in oklab, ${platform.accent} 20%, transparent)`,
            color: platform.accent,
          }}
        >
          {platform.mark}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-semibold">{platform.name}</h3>
            {state === "connected" ? <CheckCircle2 className="size-4 text-success" /> : null}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{platform.description}</p>
        </div>
      </header>

      {state === "connected" || state === "syncing" ? (
        <div className="relative flex flex-col gap-3">
          {props.connectedHandle ? (
            <p className="font-display text-sm font-semibold" style={{ color: platform.accent }}>
              {platform.handlePrefix}
              {props.connectedHandle}
            </p>
          ) : null}
          {props.followers !== null ? (
            <p className="font-display text-3xl font-bold tracking-tight">
              {compact(props.followers)}{" "}
              <span className="text-sm font-medium text-muted-foreground">followers</span>
            </p>
          ) : null}
          {state === "syncing" ? (
            <div>
              <p className="flex items-center gap-2 text-sm text-primary">
                <Loader2 className="size-3.5 animate-spin" /> Syncing analytics…
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-1/2 animate-pulse rounded-full" style={{ background: "var(--gradient-brand)" }} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Updated {relativeTime(props.lastSyncedAt)}</p>
          )}
          <div className="mt-auto flex gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              disabled={state === "syncing"}
              onClick={props.onSync}
            >
              <RefreshCw className={cn("mr-1.5 size-3.5", state === "syncing" && "animate-spin")} />
              Sync
            </Button>
            <Button size="sm" variant="ghost" onClick={props.onDisconnect} aria-label="Disconnect">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col gap-4">
          <div>
            <label
              className="label-mono mb-1.5 block text-xs text-muted-foreground"
              htmlFor={`h-${platform.id}`}
            >
              {platform.handleLabel}
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-secondary/40 px-3 py-1 transition-colors focus-within:border-primary/60">
              {platform.handlePrefix ? (
                <span className="text-sm text-muted-foreground">{platform.handlePrefix}</span>
              ) : null}
              <Input
                id={`h-${platform.id}`}
                value={props.handle}
                placeholder={platform.handlePlaceholder}
                onChange={(event) => props.onHandleChange(event.target.value)}
                onBlur={props.onHandleBlur}
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            {props.match ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
                <Sparkles className="size-3.5" /> Possible match found — {platform.handlePrefix}
                {props.match}
              </p>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Enter your handle so we can identify the account.
              </p>
            )}
          </div>

          {state === "needs_reconnection" ? (
            <p className="text-xs font-medium text-warning">Connection needs attention.</p>
          ) : null}

          {state === "error" && props.failure ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-medium text-destructive">{props.failure.message}</p>
              <button
                type="button"
                onClick={props.onToggleDetails}
                className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                More details
                <ChevronDown className={cn("size-3 transition-transform", props.expanded && "rotate-180")} />
              </button>
              {props.expanded ? (
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  {props.failure.details}
                </p>
              ) : null}
            </div>
          ) : null}

          <Button
            className="mt-auto w-full justify-between"
            size="lg"
            disabled={busy || props.disabled}
            onClick={props.onConnect}
          >
            <span className="flex items-center gap-2">
              {state === "connecting" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : state === "needs_reconnection" || state === "error" ? (
                <RefreshCw className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
              {state === "connecting"
                ? `Connecting ${platform.name}…`
                : state === "needs_reconnection"
                  ? `Reconnect ${platform.name}`
                  : state === "error"
                    ? "Try Again"
                    : `Connect ${platform.name}`}
            </span>
            <ArrowRight className="size-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      )}
    </article>
  );
}
