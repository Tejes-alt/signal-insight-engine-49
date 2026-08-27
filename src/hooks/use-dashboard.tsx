import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getWorkspace } from "@/lib/workspace.functions";
import { getPublicOverview, refreshAllPublicAccounts } from "@/lib/public.functions";
import { DashboardContext, type DashboardContextValue } from "@/hooks/dashboard-context";

export const RANGES = [
  { days: 7, label: "7D" },
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
  { days: 180, label: "6M" },
  { days: 365, label: "1Y" },
] as const;

const RANGE_KEY = "socialpulse.range";

export function DashboardProvider({ children }: { children: ReactNode }) {
  const workspaceFn = useServerFn(getWorkspace);
  const overviewFn = useServerFn(getPublicOverview);
  const refreshFn = useServerFn(refreshAllPublicAccounts);
  const queryClient = useQueryClient();

  const [rangeDays, setRangeState] = useState(30);
  const [hydrated, setHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(RANGE_KEY));
    if (RANGES.some((r) => r.days === stored)) setRangeState(stored);
    setHydrated(true);
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

  const overviewQuery = useQuery({
    queryKey: ["public-overview", orgId, rangeDays],
    queryFn: () => overviewFn({ data: { orgId: orgId!, rangeDays } }),
    enabled: Boolean(orgId) && hydrated,
    staleTime: 60_000,
  });

  const refreshAll = useCallback(async () => {
    if (!orgId) return;
    setRefreshing(true);
    toast.loading("Checking your profiles…", { id: "refresh-all" });
    try {
      await refreshFn({ data: { orgId } });
      await queryClient.invalidateQueries({ queryKey: ["public-overview"] });
      toast.success("Updated just now.", { id: "refresh-all" });
    } catch {
      toast.error("Couldn't finish checking right now.", {
        id: "refresh-all",
        description: "Your existing information is still shown. Try again in a moment.",
      });
    } finally {
      setRefreshing(false);
    }
  }, [orgId, refreshFn, queryClient]);

  const value = useMemo<DashboardContextValue>(
    () => ({
      orgId,
      email: workspaceQuery.data?.email ?? null,
      workspaceName: workspaceQuery.data?.workspace?.name ?? null,
      rangeDays,
      setRangeDays,
      overview: overviewQuery.data,
      accounts: overviewQuery.data?.accounts ?? [],
      isLoading: workspaceQuery.isLoading || overviewQuery.isLoading || !hydrated,
      error: (overviewQuery.error as Error | null) ?? (workspaceQuery.error as Error | null),
      refreshing,
      refreshAll,
      lastCheckedAt: overviewQuery.data?.lastCheckedAt ?? null,
      refetch: () => {
        void overviewQuery.refetch();
      },
    }),
    [
      orgId,
      workspaceQuery.data,
      workspaceQuery.isLoading,
      workspaceQuery.error,
      rangeDays,
      setRangeDays,
      overviewQuery,
      refreshing,
      refreshAll,
      hydrated,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export { useDashboard } from "@/hooks/dashboard-context";
export type { DashboardContextValue } from "@/hooks/dashboard-context";
