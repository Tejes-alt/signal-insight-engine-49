import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Database, Palette, ShieldCheck, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/components/theme-provider";
import { useDashboard } from "@/hooks/dashboard-context";
import { getPreferences, purgeWorkspaceData, savePreferences } from "@/lib/social.functions";
import { PLATFORM_LIST } from "@/lib/social/platforms";
import { RANGES } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings · SocialPulse" },
      {
        name: "description",
        content:
          "Manage your SocialPulse profile, workspace, notification preferences, theme, privacy controls and stored analytics.",
      },
      { property: "og:title", content: "Settings · SocialPulse" },
      { property: "og:description", content: "Profile, workspace, notifications, privacy and data controls." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const NOTIFICATION_KEYS = [
  ["sync", "Sync completed and failed"],
  ["connection", "Account connected or disconnected"],
  ["growth", "Significant growth or drops"],
  ["insights", "New insights available"],
] as const;

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof User;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel animate-rise p-6">
      <header className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="font-display font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function SettingsPage() {
  const { orgId, email, workspaceName, connections, rangeDays, setRangeDays, refetch } = useDashboard();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const prefsFn = useServerFn(getPreferences);
  const saveFn = useServerFn(savePreferences);
  const purgeFn = useServerFn(purgeWorkspaceData);

  const prefsQuery = useQuery({ queryKey: ["preferences"], queryFn: () => prefsFn() });
  const prefs = prefsQuery.data?.preferences as
    | { primary_platform: string | null; notification_settings: Record<string, boolean> }
    | null
    | undefined;

  const [primary, setPrimary] = useState<string | null>(null);
  const effectivePrimary = primary ?? prefs?.primary_platform ?? null;
  const notificationSettings = prefs?.notification_settings ?? {};

  const save = useMutation({
    mutationFn: (input: {
      theme?: "light" | "dark";
      primaryPlatform?: string | null;
      defaultRangeDays?: number;
      notificationSettings?: Record<string, boolean>;
    }) => saveFn({ data: input }),
    onSuccess: () => {
      toast.success("Preferences saved");
      void queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
    onError: (error: Error) => toast.error("Could not save", { description: error.message }),
  });

  const purge = useMutation({
    mutationFn: (scope: "analytics" | "everything") => purgeFn({ data: { orgId: orgId!, scope } }),
    onSuccess: () => {
      toast.success("Deletion complete");
      void queryClient.invalidateQueries();
      refetch();
    },
    onError: (error: Error) => toast.error("Deletion failed", { description: error.message }),
  });

  return (
    <AppShell>
      <PageHeader title="Settings" description="Your profile, workspace, preferences and privacy controls." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={User} title="Profile" description="The account you are signed in with.">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate font-medium">{email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Workspace</dt>
              <dd className="truncate font-medium">{workspaceName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Connected accounts</dt>
              <dd className="font-medium">{connections.length}</dd>
            </div>
          </dl>
        </Section>

        <Section icon={Palette} title="Theme" description="Choose how SocialPulse looks.">
          <div className="flex gap-2">
            {(["light", "dark"] as const).map((option) => (
              <button
                key={option}
                onClick={() => {
                  setTheme(option);
                  save.mutate({ theme: option });
                }}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-sm font-medium capitalize transition-all",
                  theme === option
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </Section>

        <Section
          icon={Bell}
          title="Notifications"
          description="Choose which events appear in your notification center."
        >
          <div className="space-y-3">
            {NOTIFICATION_KEYS.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={notificationSettings[key] !== false}
                  onCheckedChange={(checked) =>
                    save.mutate({
                      notificationSettings: { ...notificationSettings, [key]: checked },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </Section>

        <Section
          icon={Database}
          title="Dashboard defaults"
          description="Your primary platform and default date range."
        >
          <label className="label-mono mb-1.5 block text-xs text-muted-foreground">Primary platform</label>
          <select
            className="mb-4 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={effectivePrimary ?? ""}
            onChange={(event) => {
              const value = event.target.value || null;
              setPrimary(value);
              save.mutate({ primaryPlatform: value });
            }}
          >
            <option value="">No preference</option>
            {PLATFORM_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <label className="label-mono mb-1.5 block text-xs text-muted-foreground">Default date range</label>
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => {
                  setRangeDays(r.days);
                  save.mutate({ defaultRangeDays: r.days });
                }}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                  rangeDays === r.days
                    ? "border-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Section>

        <Section
          icon={ShieldCheck}
          title="Privacy"
          description="How SocialPulse handles access to your social accounts."
        >
          <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>SocialPulse never receives, requests or stores your social-media passwords.</li>
            <li>Authorization happens entirely on each platform's own website.</li>
            <li>Your account access stays securely on our servers and never reaches your browser.</li>
            <li>You can disconnect any account at any time from the Accounts page.</li>
            <li>You can delete your stored analytics or your entire workspace data below.</li>
            <li>Only members of your workspace can read your analytics — enforced in the database.</li>
          </ul>
        </Section>

        <Section icon={Trash2} title="Data" description="Delete what SocialPulse has stored for you.">
          <div className="space-y-3">
            <Button
              variant="secondary"
              className="w-full"
              disabled={purge.isPending}
              onClick={() => {
                if (window.confirm("Delete all stored analytics, content and insights for this workspace?"))
                  purge.mutate("analytics");
              }}
            >
              Delete stored analytics
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              disabled={purge.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Disconnect every account and delete all SocialPulse data for this workspace? This cannot be undone.",
                  )
                )
                  purge.mutate("everything");
              }}
            >
              Disconnect all accounts & delete my data
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Deleting removes your connections, stored metrics, history, content and insights. Social platforms may
              keep their own records of a revoked authorization for a short period on their side.
            </p>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
