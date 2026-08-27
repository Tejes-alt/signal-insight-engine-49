import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useDashboard, withDashboard } from "@/hooks/use-dashboard";
import { getSetupStatus } from "@/lib/social.functions";
import { platformName } from "@/lib/social/platforms";

export const Route = createFileRoute("/_authenticated/admin")({
  component: withDashboard(AdminPage),
  head: () => ({
    meta: [
      { title: "Setup status · SocialPulse" },
      {
        name: "description",
        content: "Developer setup status for the SocialPulse installation: provider, database and sync jobs.",
      },
      { property: "og:title", content: "Setup status · SocialPulse" },
      { property: "og:description", content: "Provider, database and synchronization health for this installation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Check({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/60 py-3 last:border-0">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      )}
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{ok ? "Configured" : (hint ?? "Not configured")}</p>
      </div>
    </div>
  );
}

function AdminPage() {
  const { orgId } = useDashboard();
  const statusFn = useServerFn(getSetupStatus);
  const query = useQuery({
    queryKey: ["setup", orgId],
    queryFn: () => statusFn({ data: { orgId: orgId! } }),
    enabled: Boolean(orgId),
  });

  return (
    <AppShell>
      <PageHeader
        title="Setup status"
        description="Installation health for administrators. Secret values are never displayed here."
      />
      {query.isLoading ? (
        <div className="panel flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking configuration…
        </div>
      ) : query.data ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="lg:col-span-2">
            {query.data.configuredCount > 0 ? (
              <div className="panel animate-rise flex items-center gap-3 border-success/40 p-4 text-sm">
                <CheckCircle2 className="size-5 shrink-0 text-success" />
                <span className="font-medium">
                  Social integrations ready ✓ — {query.data.configuredCount} of{" "}
                  {query.data.integrations.length} platforms
                </span>
              </div>
            ) : (
              <div className="panel animate-rise flex items-start gap-3 border-warning/40 p-4 text-sm">
                <XCircle className="mt-0.5 size-5 shrink-0 text-warning" />
                <div>
                  <p className="font-medium">⚠ Configuration required</p>
                  <p className="text-muted-foreground">
                    No platform developer credentials are present on this installation yet. End users
                    never configure anything — they only authorize their own accounts.
                  </p>
                </div>
              </div>
            )}
          </div>

          <section className="panel animate-rise p-6">
            <h2 className="font-display mb-2 font-semibold">Platform integrations</h2>
            {query.data.integrations.map((integration) => (
              <Check
                key={integration.platform}
                ok={integration.configured}
                label={integration.name}
                hint={`Waiting on server credentials: ${integration.missing.join(", ")}.`}
              />
            ))}
          </section>

          <section className="panel animate-rise p-6">
            <h2 className="font-display mb-2 font-semibold">Pipeline</h2>
            <Check ok={query.data.database} label="Database connection" />
            <Check
              ok={query.data.connections > 0}
              label="Connected accounts"
              hint="No account has completed authorization yet."
            />
            <Check
              ok={query.data.backgroundSync.enabled}
              label="Background synchronization"
              hint="Starts automatically once an account is connected."
            />
            <Check
              ok={query.data.analyticsReady}
              label="Analytics pipeline"
              hint="Runs after the first account is connected."
            />
            <p className="mt-3 text-xs text-muted-foreground">
              {query.data.backgroundSync.due} account(s) due for refresh
              {query.data.backgroundSync.nextSyncAt
                ? ` · next scheduled refresh ${new Date(query.data.backgroundSync.nextSyncAt).toLocaleString()}`
                : ""}
            </p>
          </section>



          <section className="panel animate-rise p-6">
            <h2 className="font-display mb-3 font-semibold">Recent sync jobs</h2>
            {query.data.recentSyncs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts have been synchronized yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {query.data.recentSyncs.map((job) => (
                  <li key={job.platform} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
                    <span className="font-medium">{platformName(job.platform)}</span>
                    <span className="text-xs text-muted-foreground">
                      {job.status}
                      {job.at ? ` · ${new Date(job.at).toLocaleString()}` : ""}
                      {job.error ? ` · ${job.error}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div className="panel p-6 text-sm text-destructive">Setup status is unavailable right now.</div>
      )}
    </AppShell>
  );
}
