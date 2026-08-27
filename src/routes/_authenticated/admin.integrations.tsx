import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Database, ShieldAlert } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useDashboard } from "@/hooks/dashboard-context";
import { getSetupStatus } from "@/lib/social.functions";
import { SkeletonCard } from "@/components/metrics";

/**
 * Internal diagnostics. Technical detail lives here and nowhere else — normal
 * users never see this route in navigation, and non-admins are told plainly
 * that the page isn't theirs.
 */
export const Route = createFileRoute("/_authenticated/admin/integrations")({
  head: () => ({
    meta: [
      { title: "Integration diagnostics · SocialPulse" },
      { name: "description", content: "Internal integration and sync diagnostics for SocialPulse operators." },
      { property: "og:title", content: "Integration diagnostics · SocialPulse" },
      { property: "og:description", content: "Internal diagnostics for SocialPulse operators." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminIntegrationsPage,
});

function AdminIntegrationsPage() {
  const { orgId } = useDashboard();
  const statusFn = useServerFn(getSetupStatus);
  const query = useQuery({
    queryKey: ["setup-status", orgId],
    queryFn: () => statusFn({ data: { orgId: orgId! } }),
    enabled: Boolean(orgId),
    retry: false,
  });

  if (query.isError) {
    return (
      <AppShell>
        <div className="panel mx-auto max-w-lg p-8 text-center">
          <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-3 font-display text-xl font-semibold">This page isn't available for your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Head back to your dashboard to keep tracking.</p>
        </div>
      </AppShell>
    );
  }

  const data = query.data;

  return (
    <AppShell>
      <PageHeader
        title="Integration diagnostics"
        description="Operator-only view of platform authorization configuration, database reachability and background sync."
      />

      {query.isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="panel p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Authorization providers ready
              </p>
              <p className="mt-2 font-display text-2xl font-bold">
                {data.configuredCount} / {data.integrations.length}
              </p>
            </div>
            <div className="panel p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Database</p>
              <p className="mt-2 flex items-center gap-2 font-display text-2xl font-bold">
                <Database className="size-5 text-primary" />
                {data.database ? "Reachable" : "Unreachable"}
              </p>
            </div>
            <div className="panel p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Background sync
              </p>
              <p className="mt-2 font-display text-2xl font-bold">
                {data.backgroundSync.enabled ? `${data.backgroundSync.due} due` : "Idle"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Next: {data.backgroundSync.nextSyncAt ? new Date(data.backgroundSync.nextSyncAt).toLocaleString() : "—"}
              </p>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Authorization</th>
                  <th className="px-4 py-3">Missing configuration</th>
                </tr>
              </thead>
              <tbody>
                {data.integrations.map((row) => (
                  <tr key={row.platform} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">
                      {row.configured ? (
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="size-4" /> Configured
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-amber-400">
                          <AlertTriangle className="size-4" /> Not configured
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {row.missing.length ? row.missing.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Public profile tracking works regardless of the table above. Missing configuration only disables optional
            private-analytics authorization for that platform.
          </p>
        </div>
      )}
    </AppShell>
  );
}
