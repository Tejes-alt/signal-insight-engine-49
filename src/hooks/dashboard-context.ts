import { createContext, useContext } from "react";
import type { AnalyticsBundle } from "@/lib/analytics/dashboard";

export interface SocialConnectionView {
  id: string;
  platform: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  permissions: string[];
  syncStatus: string;
  syncError: string | null;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  metrics: Record<string, { value: number | null; status: string; reason?: string }>;
}

export interface DashboardContextValue {
  orgId: string | null;
  email: string | null;
  workspaceName: string | null;
  isAdmin: boolean;
  demo: boolean;
  setDemo: (value: boolean) => void;
  rangeDays: number;
  setRangeDays: (days: number) => void;
  bundle: AnalyticsBundle | undefined;
  isLoading: boolean;
  error: Error | null;
  connections: SocialConnectionView[];
  connectedCount: number;
  integrations: { platform: string; configured: boolean; missing: string[] }[];
  integrationsReady: boolean;
  lastSyncedAt: string | null;
  syncing: boolean;
  syncAll: () => Promise<void>;
  refetch: () => void;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboard must be used inside DashboardProvider");
  return context;
}