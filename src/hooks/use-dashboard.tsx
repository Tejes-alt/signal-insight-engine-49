import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getWorkspace } from "@/lib/workspace.functions";
import { getDashboard } from "@/lib/dashboard.functions";
import { getSocialState, syncAllAccounts, syncStaleAccounts } from "@/lib/social.functions";
import {
  DashboardContext,
  type DashboardContextValue,
  type SocialConnectionView,
} from "@/hooks/dashboard-context";

import { platformName } from "@/lib/social/platforms";

export const RANGES = [
  { days: 7, label: "7D" },
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
  { days: 180, label: "6M" },
  { days: 365, label: "1Y" },
] as const;

const DEMO_KEY = "socialpulse.demo";
const RANGE_KEY = "socialpulse.range";

export function DashboardProvider({ children }: { children: ReactNode }) {
  const workspaceFn = useServerFn(getWorkspace);
  const dashboardFn = useServerFn(getDashboard);
  const socialFn = useServerFn(getSocialState);
  const syncFn = useServerFn(syncAllAccounts);
  const staleFn = useServerFn(syncStaleAccounts);

  const queryClient = useQueryClient();

  const [demo, setDemoState] = useState(true);
  const [rangeDays, setRangeState] = useState(30);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const storedDemo = window.localStorage.getItem(DEMO_KEY);
    if (storedDemo !== null) setDemoState(storedDemo === "true");
    const storedRange = Number(window.localStorage.getItem(RANGE_KEY));
    if (RANGES.some((r) => r.days === storedRange)) setRangeState(storedRange);
    setHydrated(true);
  }, []);

  const setDemo = useCallback((value: boolean) => {
    setDemoState(value);
    window.localStorage.setItem(DEMO_KEY, String(value));
  }, []);

  const setRangeDays = useCallback((days: number) => {
    setRangeState(days);
    window.localStorage.setItem(RANGE_KEY, String(days));
  }, []);

  const workspaceQuery = useQuery({
    queryKey: ["workspace"],
    queryFn: () => workspaceFn(),
    staleTime: 5 * 60_000,
  });

  const orgId = workspaceQuery.data?.workspace?.id ?? null;

  const socialQuery = useQuery({
    queryKey: ["social", orgId],
    queryFn: () => socialFn({ data: { orgId: orgId! } }),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  });

  const connections = (socialQuery.data?.connections ?? []) as SocialConnectionView[];
  const live = connections.filter((c) => c.status === "connected" || c.status === "synced");

  // Real data takes over automatically the moment an account is connected.
  useEffect(() => {
    if (!hydrated) return;
    if (live.length > 0 && demo && window.localStorage.getItem(DEMO_KEY) === null) setDemo(false);
  }, [live.length, demo, hydrated, setDemo]);

  // Automatic refresh: accounts whose scheduled refresh has elapsed are synced
  // in the background. Fresh accounts are left alone, so quota is never wasted.
  const [autoSyncDone, setAutoSyncDone] = useState(false);
  useEffect(() => {
    if (!orgId || autoSyncDone || live.length === 0) return;
    const due = live.some((c) => !c.nextSyncAt || Date.parse(c.nextSyncAt) <= Date.now());
    if (!due) return;
    setAutoSyncDone(true);
    void (async () => {
      try {
        const { synced } = await staleFn({ data: { orgId } });
        if (synced > 0) {
          await queryClient.invalidateQueries({ queryKey: ["social", orgId] });
          await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        }
      } catch {
        // Silent: the last known good data stays on screen.
      }
    })();
  }, [orgId, autoSyncDone, live, staleFn, queryClient]);


  const dashboardQuery = useQuery({
    queryKey: ["dashboard", orgId, rangeDays, demo],
    queryFn: () => dashboardFn({ data: { orgId: orgId!, rangeDays, demo } }),
    enabled: Boolean(orgId) && hydrated,
    staleTime: 60_000,
  });

  const lastSyncedAt = live
    .map((c) => c.lastSyncedAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1) ?? null;

  const syncAll = useCallback(async () => {
    if (!orgId) return;
    setSyncing(true);
    toast.loading("Syncing your social accounts…", { id: "sync-all" });
    try {
      const { outcomes } = await syncFn({ data: { orgId } });
      for (const outcome of outcomes) {
        if (outcome.ok) toast.success(`${platformName(outcome.platform)} updated`);
        else toast.error(`${platformName(outcome.platform)} failed`, { description: outcome.error });
      }
      toast.success("All accounts synchronized", { id: "sync-all" });
      await queryClient.invalidateQueries({ queryKey: ["social", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", orgId] });
    } catch (error) {
      toast.error("Sync failed", {
        id: "sync-all",
        description: error instanceof Error ? error.message : "Please try again shortly.",
      });
    } finally {
      setSyncing(false);
    }
  }, [orgId, syncFn, queryClient]);

  const value = useMemo<DashboardContextValue>(
    () => ({
      orgId,
      email: workspaceQuery.data?.email ?? null,
      workspaceName: workspaceQuery.data?.workspace?.name ?? null,
      isAdmin: workspaceQuery.data?.isAdmin ?? false,
      demo,
      setDemo,
      rangeDays,
      setRangeDays,
      bundle: dashboardQuery.data,
      isLoading: workspaceQuery.isLoading || dashboardQuery.isLoading || !hydrated,
      error: (dashboardQuery.error as Error | null) ?? (workspaceQuery.error as Error | null),
      connections,
      connectedCount: live.length,
      integrations: socialQuery.data?.integrations ?? [],
      integrationsReady:
        (socialQuery.data?.config?.anyConfigured ?? workspaceQuery.data?.integrationsReady) ?? false,

      lastSyncedAt,
      syncing,
      syncAll,
      refetch: () => {
        void dashboardQuery.refetch();
        void socialQuery.refetch();
      },
    }),
    [
      orgId,
      workspaceQuery.data,
      workspaceQuery.isLoading,
      workspaceQuery.error,
      demo,
      setDemo,
      rangeDays,
      setRangeDays,
      dashboardQuery,
      socialQuery,
      connections,
      live.length,
      lastSyncedAt,
      syncing,
      syncAll,
      hydrated,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export { useDashboard } from "@/hooks/dashboard-context";
export type { DashboardContextValue, SocialConnectionView } from "@/hooks/dashboard-context";
