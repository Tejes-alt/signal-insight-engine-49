import { createContext, useContext } from "react";
import type { OverviewBundle, PublicAccountView } from "@/lib/public/types";

export interface DashboardContextValue {
  orgId: string | null;
  email: string | null;
  workspaceName: string | null;
  rangeDays: number;
  setRangeDays: (days: number) => void;
  overview: OverviewBundle | undefined;
  accounts: PublicAccountView[];
  isLoading: boolean;
  error: Error | null;
  refreshing: boolean;
  refreshAll: () => Promise<void>;
  refetch: () => void;
  lastCheckedAt: string | null;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboard must be used inside DashboardProvider");
  return context;
}
