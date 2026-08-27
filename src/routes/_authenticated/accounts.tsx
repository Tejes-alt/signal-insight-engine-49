import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Circle, Lock, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { AnimatedNumber, formatNumber } from "@/components/metrics";
import { PLATFORM_ACCENT, PlatformMark } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboard } from "@/hooks/dashboard-context";
import { PLATFORM_LIST, type PlatformId } from "@/lib/social/platforms";
import {
  PRIVATE_METRIC_LABELS,
  PUBLIC_METRIC_LABELS,
  STATUS_COPY,
  type PublicAccountView,
} from "@/lib/public/types";
import { addPublicAccount, refreshPublicAccount, removePublicAccount } from "@/lib/public.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
  head: () => ({
    meta: [
      { title: "Accounts · SocialPulse" },
      {
        name: "description",
        content:
          "Add your social handles and SocialPulse analyzes the information your profiles share publicly — no passwords, ever.",
      },
      { property: "og:title", content: "Accounts · SocialPulse" },
      {
        property: "og:description",
        content: "Add a handle, see your public presence. Private metrics stay private until you authorize them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function relative(iso: string | null): string {
  if (!iso) return "not checked yet";
  const seconds = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function DataAvailability({ account }: { account: PublicAccountView }) {
  return (
    <div className="mt-4 grid gap-4 rounded-xl border border-border bg-secondary/40 p-4 sm:grid-cols-2">
      <div>
        <p className="label-mono">Public data</p>
        <ul className="mt-2 space-y-1.5">
          {(Object.keys(PUBLIC_METRIC_LABELS) as Array<keyof typeof PUBLIC_METRIC_LABELS>).map((key) => {
            const has = account.retrieved.includes(key);
            return (
              <li
                key={key}
                className={cn("flex items-center gap-2 text-xs", has ? "text-foreground" : "text-muted-foreground")}
              >
                {has ? <Check className="size-3.5 text-success" /> : <Circle className="size-3 opacity-50" />}
                {PUBLIC_METRIC_LABELS[key]}
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <p className="label-mono">Private data</p>
        <ul className="mt-2 space-y-1.5">
          {PRIVATE_METRIC_LABELS.map((label) => (
            <li key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Circle className="size-3 opacity-50" />
              {label}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
          These require authorization from the platform itself.
        </p>
      </div>
    </div>
  );
}

function AccountCard({ account }: { account: PublicAccountView }) {
  const { orgId } = useDashboard();
  const queryClient = useQueryClient();
  const refreshFn = useServerFn(refreshPublicAccount);
  const removeFn = useServerFn(removePublicAccount);
  const [open, setOpen] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["public-overview"] });

  const refresh = useMutation({
    mutationFn: () => refreshFn({ data: { orgId: orgId!, accountId: account.id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Updated just now.");
    },
    onError: () => toast.error("Couldn't check this profile right now."),
  });

  const remove = useMutation({
    mutationFn: () => removeFn({ data: { orgId: orgId!, accountId: account.id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Account removed.");
    },
    onError: () => toast.error("Couldn't remove this account."),
  });

  const copy = STATUS_COPY[account.status];
  const resolved = account.status === "available" || account.status === "partial";
  const accent = PLATFORM_ACCENT[account.platform];

  return (
    <article className="panel panel-hover group relative overflow-hidden p-5">
      <span
        className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ background: accent }}
      />
      <div className="flex items-start gap-4">
        <PlatformMark provider={account.platform} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-semibold">{account.displayName ?? account.handle}</h2>
            <span className="label-mono truncate">{account.handle}</span>
          </div>
          <p
            className={cn(
              "mt-1 text-sm",
              resolved ? "text-success" : account.status === "pending" ? "text-primary" : "text-muted-foreground",
            )}
          >
            {copy.label}
          </p>
          <p className="text-xs text-muted-foreground">{account.statusMessage ?? copy.hint}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh"
            disabled={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            <RefreshCw className={cn("size-4", refresh.isPending && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove account"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {resolved ? (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Followers", value: account.metrics.followers ?? null },
            {
              label: "Public engagement",
              value: account.engagementRate,
              suffix: "%",
            },
            { label: "Content", value: account.metrics.posts ?? null },
            { label: "Avg likes", value: account.avgLikes },
          ].map((cell) => (
            <div key={cell.label}>
              <p className="label-mono">{cell.label}</p>
              <p className="mt-1 font-display text-xl font-semibold tabular">
                {cell.value === null ? (
                  <span className="text-sm font-normal text-muted-foreground">Requires account connection</span>
                ) : (
                  <>
                    <AnimatedNumber value={cell.value} format={cell.suffix ? (n) => n.toFixed(1) : formatNumber} />
                    {cell.suffix}
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">Last checked {relative(account.lastCheckedAt)}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            Data availability
          </Button>
          <Button variant="outline" size="sm" disabled title="Coming soon">
            <Lock className="mr-1.5 size-3.5" /> Unlock private analytics
          </Button>
        </div>
      </div>

      {open ? <DataAvailability account={account} /> : null}
    </article>
  );
}

function AddAccountForm() {
  const { orgId, accounts } = useDashboard();
  const queryClient = useQueryClient();
  const addFn = useServerFn(addPublicAccount);
  const [platform, setPlatform] = useState<PlatformId>("instagram");
  const [handle, setHandle] = useState("");

  const descriptor = PLATFORM_LIST.find((p) => p.id === platform)!;

  const add = useMutation({
    mutationFn: () => addFn({ data: { orgId: orgId!, platform, handle: handle.trim() } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["public-overview"] });
      setHandle("");
      if (result?.status === "not_found") toast.error("Couldn't find this account. Check the username.");
      else if (result?.status === "unavailable")
        toast.message("Added — public data isn't currently available for this platform.");
      else toast.success("Profile found. Tracking started today.");
    },
    onError: () => toast.error("Couldn't add that account. Please try again."),
  });

  const already = accounts.some((a) => a.platform === platform && a.handle.toLowerCase() === handle.trim().toLowerCase());

  return (
    <section className="panel p-5">
      <h2 className="font-display text-base font-semibold">Add an account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your public username or profile link. SocialPulse never asks for a social media password.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {PLATFORM_LIST.map((p) => (
          <button
            key={p.id}
            onClick={() => setPlatform(p.id)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5",
              platform === p.id
                ? "border-transparent bg-secondary text-foreground shadow-[var(--shadow-soft)]"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
            style={platform === p.id ? { boxShadow: `inset 0 0 0 1px ${PLATFORM_ACCENT[p.id]}` } : undefined}
          >
            <PlatformMark provider={p.id} size="sm" />
            {p.name}
          </button>
        ))}
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (handle.trim() && !already) add.mutate();
        }}
      >
        <Input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={descriptor.handlePlaceholder}
          aria-label={`${descriptor.name} ${descriptor.handleLabel}`}
          className="sm:flex-1"
        />
        <Button type="submit" disabled={!handle.trim() || already || add.isPending}>
          {add.isPending ? (
            <RefreshCw className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Plus className="mr-1.5 size-4" />
          )}
          Add {descriptor.name}
        </Button>
      </form>
      {already ? <p className="mt-2 text-xs text-warning">You're already tracking that account.</p> : null}
    </section>
  );
}

function AccountsPage() {
  const { accounts, isLoading, refreshAll, refreshing } = useDashboard();

  return (
    <AppShell>
      <PageHeader
        title="Accounts"
        description="Add your handles and SocialPulse analyzes what your profiles share publicly."
        actions={
          accounts.length > 0 ? (
            <Button variant="secondary" disabled={refreshing} onClick={() => void refreshAll()}>
              <RefreshCw className={cn("mr-1.5 size-4", refreshing && "animate-spin")} />
              Refresh all
            </Button>
          ) : null
        }
      />

      <div className="grid gap-5">
        <AddAccountForm />
        {isLoading ? (
          <div className="panel h-40 animate-pulse" />
        ) : accounts.length === 0 ? (
          <div className="panel px-6 py-14 text-center">
            <h3 className="font-display text-lg font-semibold">No accounts yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Add your first handle above — your public followers, content and engagement appear right away.
            </p>
          </div>
        ) : (
          <div className="stagger grid gap-4 xl:grid-cols-2">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
