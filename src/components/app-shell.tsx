import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  FlaskConical,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Moon,
  Play,
  RefreshCw,
  Settings,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNotifications, markNotificationsRead } from "@/lib/social.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme-provider";
import { RANGES } from "@/hooks/use-dashboard";
import { useDashboard } from "@/hooks/dashboard-context";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/content", label: "Content", icon: Play },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/accounts", label: "Accounts", icon: Link2 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const ADMIN_NAV = [{ to: "/admin/integrations", label: "Diagnostics", icon: Activity }] as const;

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative grid size-9 place-items-center rounded-xl" style={{ background: "var(--gradient-brand)" }}>
        <span className="font-display text-sm font-bold text-background">S</span>
        <span className="live-dot absolute -right-0.5 -top-0.5" />
      </span>
      {!compact ? (
        <span className="font-display text-lg font-bold tracking-tight">
          Social<span className="gradient-text">Pulse</span>
        </span>
      ) : null}
    </span>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useDashboard();
  const items = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ to, label, icon: Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow-soft)]"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
            )}
          >
            {active ? (
              <span
                className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full"
                style={{ background: "var(--gradient-brand)" }}
              />
            ) : null}
            <Icon className={cn("size-4 transition-transform duration-200 group-hover:scale-110", active && "text-primary")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}


function RangePicker() {
  const { rangeDays, setRangeDays } = useDashboard();
  return (
    <div className="flex items-center rounded-xl border border-border bg-secondary/50 p-1">
      {RANGES.map((r) => (
        <button
          key={r.days}
          onClick={() => setRangeDays(r.days)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-200",
            rangeDays === r.days
              ? "bg-background text-foreground shadow-[var(--shadow-soft)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const seconds = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

/** Honest status: we only ever claim "last checked", never real-time. */
function SyncStatus() {
  const { accounts, lastCheckedAt, refreshing, refreshAll } = useDashboard();

  return (
    <div className="hidden items-center gap-2 md:flex">
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-2.5 py-1 text-xs font-semibold",
          refreshing ? "text-primary" : "text-muted-foreground",
        )}
      >
        {refreshing ? (
          <>
            <RefreshCw className="size-3 animate-spin" /> Checking…
          </>
        ) : accounts.length === 0 ? (
          "No accounts yet"
        ) : (
          `Last checked ${relativeTime(lastCheckedAt)}`
        )}
      </span>
      {accounts.length > 0 ? (
        <Button size="sm" variant="secondary" disabled={refreshing} onClick={() => void refreshAll()}>
          <RefreshCw className={cn("mr-1.5 size-3.5", refreshing && "animate-spin")} />
          Refresh all
        </Button>
      ) : null}
    </div>
  );
}

function NotificationBell() {
  const { orgId } = useDashboard();
  const listFn = useServerFn(getNotifications);
  const readFn = useServerFn(markNotificationsRead);
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["notifications", orgId],
    queryFn: () => listFn({ data: { orgId: orgId! } }),
    enabled: Boolean(orgId),
    refetchInterval: 60_000,
  });
  const items = query.data?.notifications ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unread > 0 && orgId) void readFn({ data: { orgId } }).then(() => query.refetch());
        }}
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-primary text-[0.6rem] font-bold text-background">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="glass animate-rise absolute right-0 top-11 z-50 w-80 rounded-2xl p-2">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="rounded-xl px-3 py-2 hover:bg-secondary/50">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
                  <p className="text-[0.7rem] text-muted-foreground">{relativeTime(n.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { theme, toggle } = useTheme();
  const { refetch, isLoading, email } = useDashboard();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-x-0 border-t-0 px-4 md:px-7">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label="Open navigation">
        <Menu className="size-5" />
      </Button>
      <div className="lg:hidden">
        <Logo compact />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <SyncStatus />
        <RangePicker />
        <NotificationBell />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={refetch} aria-label="Refresh data">
              <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{theme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
        </Tooltip>
        <div className="hidden items-center gap-2 rounded-xl border border-border bg-secondary/50 py-1 pl-3 pr-1 sm:flex">
          <span className="max-w-[11rem] truncate text-xs text-muted-foreground">{email ?? "Signed in"}</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/dashboard" className="px-2 pt-2" onClick={onNavigate}>
        <Logo />
      </Link>
      <SidebarNav onNavigate={onNavigate} />
      <div className="mt-auto space-y-3">
        <div className="panel p-3">
          <p className="text-sm font-semibold">Public presence tracking</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            SocialPulse reads what your profiles share publicly. Private metrics stay hidden until you authorize a
            platform.
          </p>
        </div>
      </div>
    </div>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="aurora min-h-screen">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar/70 backdrop-blur-xl lg:block">
          <div className="sticky top-0 h-screen">
            <SidebarBody />
          </div>
        </aside>

        {menuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="animate-fade absolute inset-0 bg-background/70 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation"
            />
            <div className="animate-rise absolute inset-y-0 left-0 w-72 border-r border-sidebar-border bg-sidebar">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-3"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation"
              >
                <X className="size-5" />
              </Button>
              <SidebarBody onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenMenu={() => setMenuOpen(true)} />
          <main className="mx-auto w-full max-w-[100rem] flex-1 px-4 py-6 md:px-7 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return <ShellInner>{children}</ShellInner>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="animate-rise mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
