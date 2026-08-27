import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspace } from "@/lib/workspace.functions";
import { getSources } from "@/lib/sources.functions";
import { getDashboard } from "@/lib/dashboard.functions";
import type { AnalyticsBundle } from "@/lib/analytics/dashboard";

export const RANGES = [
  { days: 7, label: "7D" },
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
  { days: 365, label: "1Y" },
] as const;

const DEMO_KEY = "pulse.demo";
const RANGE_KEY = "pulse.range";

interface DashboardContextValue {
  orgId: string | null;
  email: string | null;
  workspaceName: string | null;
  demo: boolean;
  setDemo: (value: boolean) => void;
  rangeDays: number;
  setRangeDays: (days: number) => void;
  bundle: AnalyticsBundle | undefined;
  isLoading: boolean;
  error: Error | null;
  connectedCount: number;
  refetch: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const workspaceFn = useServerFn(getWorkspace);
  const sourcesFn = useServerFn(getSources);
  const dashboardFn = useServerFn(getDashboard);

  const [demo, setDemoState] = useState(true);
  const [rangeDays, setRangeState] = useState(30);
  const [hydrated, setHydrated] = useState(false);

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

  const sourcesQuery = useQuery({
    queryKey: ["sources", orgId],
    queryFn: () => sourcesFn({ data: { orgId: orgId! } }),
    enabled: Boolean(orgId),
  });

  const connectedCount = (sourcesQuery.data?.sources ?? []).filter(
    (s) => s.status === "connected" || s.status === "active",
  ).length;

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", orgId, rangeDays, demo],
    queryFn: () => dashboardFn({ data: { orgId: orgId!, rangeDays, demo } }),
    enabled: Boolean(orgId) && hydrated,
    staleTime: 60_000,
  });

  const value = useMemo<DashboardContextValue>(
    () => ({
      orgId,
      email: workspaceQuery.data?.email ?? null,
      workspaceName: workspaceQuery.data?.workspace?.name ?? null,
      demo,
      setDemo,
      rangeDays,
      setRangeDays,
      bundle: dashboardQuery.data,
      isLoading: workspaceQuery.isLoading || dashboardQuery.isLoading || !hydrated,
      error: (dashboardQuery.error as Error | null) ?? (workspaceQuery.error as Error | null),
      connectedCount,
      refetch: () => {
        void dashboardQuery.refetch();
        void sourcesQuery.refetch();
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
      sourcesQuery,
      connectedCount,
      hydrated,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider");
  return ctx;
}
