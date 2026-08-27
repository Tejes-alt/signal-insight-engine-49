import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, Moon, Search, Settings, Sun, UserRound, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getNotifications, markNotificationsRead } from "@/lib/social.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme-provider";
import { RANGES } from "@/hooks/use-dashboard";
import { useDashboard } from "@/hooks/dashboard-context";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { SocialPulseLogo } from "@/components/brand";
import { SignalScan, usePointerField } from "@/components/signal";
import {
  IconAccounts,
  IconContent,
  IconGrowth,
  IconImport,
  IconInsight,
  IconOverview,
  IconSignal,
} from "@/components/icons";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: IconOverview },
  { to: "/analytics", label: "Analytics", icon: IconGrowth },
  { to: "/content", label: "Content", icon: IconContent },
  { to: "/insights", label: "Insights", icon: IconInsight },
] as const;

const NAV_SOURCES = [
  { to: "/accounts", label: "Accounts", icon: IconAccounts },
  { to: "/import", label: "Import Center", icon: IconImport },
] as const;

const NAV_FOOTER = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

/** Kept as a named export for existing imports; now the real lockup. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return <SocialPulseLogo compact={compact} />;
}

function NavGroup({
  title,
  items,
  onNavigate,
}: {
  title?: string;
  items: readonly { to: string; label: string; icon: (props: { size?: number; className?: string }) => ReactNode }[];
  onNavigate?: (() => void) | undefined;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div>
      {title ? <p className="label-faint px-3 pb-2">{title}</p> : null}
      <nav className="flex flex-col">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
              )}
            >
              {active ? (
                <span className="absolute -left-4 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-primary" />
              ) : null}
              <Icon size={16} className={active ? "text-primary" : undefined} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function RangePicker() {
  const { rangeDays, setRangeDays } = useDashboard();
  const activeIndex = RANGES.findIndex((r) => r.days === rangeDays);
  return (
    <div className="relative hidden items-center rounded-md border border-border p-[3px] sm:flex">
      <span
        className="absolute bottom-[3px] top-[3px] rounded-[4px] bg-secondary transition-[left] duration-200"
        style={{
          width: `calc((100% - 6px) / ${RANGES.length})`,
          left: `calc(3px + (100% - 6px) / ${RANGES.length} * ${Math.max(0, activeIndex)})`,
        }}
        aria-hidden
      />
      {RANGES.map((r) => (
        <button
          key={r.days}
          onClick={() => setRangeDays(r.days)}
          className={cn(
            "relative z-10 min-w-9 px-2 py-1 font-mono text-[0.68rem] uppercase tracking-[0.1em] transition-colors",
            rangeDays === r.days ? "text-foreground" : "text-faint hover:text-muted-foreground",
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
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Honest status: we only ever claim "last reading", never real-time. */
function SyncStatus() {
  const { accounts, lastCheckedAt, refreshing, refreshAll } = useDashboard();
  if (refreshing) return <SignalScan label="Reading" className="hidden md:flex" />;
  return (
    <div className="hidden items-center gap-3 md:flex">
      <span className="label-faint">
        {accounts.length === 0 ? "no sources" : `read ${relativeTime(lastCheckedAt)}`}
      </span>
      {accounts.length > 0 ? (
        <button
          onClick={() => void refreshAll()}
          className="press font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary"
        >
          Refresh
        </button>
      ) : null}
    </div>
  );
}

function SignalInbox() {
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
      <button
        aria-label="Signals"
        className="press relative grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unread > 0 && orgId) void readFn({ data: { orgId } }).then(() => query.refetch());
        }}
      >
        <IconSignal size={16} />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
        ) : null}
      </button>
      {open ? (
        <div className="overlay-surface animate-rise absolute right-0 top-10 z-50 w-80 p-1">
          <p className="label-faint px-3 py-2">Signals</p>
          {items.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-muted-foreground">Nothing detected yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="rounded-md px-3 py-2 hover:bg-secondary/60">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
                  <p className="label-faint mt-1">{relativeTime(n.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TopBar({ onOpenMenu, onOpenCommand }: { onOpenMenu: () => void; onOpenCommand: () => void }) {
  const { theme, toggle } = useTheme();
  const { email } = useDashboard();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="glass sticky top-0 z-30 flex h-13 items-center gap-3 border-x-0 border-t-0 px-4 py-2.5 md:px-8">
      <button
        className="press grid size-8 place-items-center rounded-md text-muted-foreground lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>
      <div className="lg:hidden">
        <SocialPulseLogo compact size={22} />
      </div>

      <button
        onClick={onOpenCommand}
        className="press ml-1 hidden w-64 items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-faint transition-colors hover:border-border-strong hover:text-muted-foreground lg:flex"
        aria-label="Open command palette"
      >
        <Search className="size-3.5" />
        Search
        <span className="kbd ml-auto">⌘K</span>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <SyncStatus />
        <RangePicker />
        <SignalInbox />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="press grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{theme === "dark" ? "Light" : "Dark"}</TooltipContent>
        </Tooltip>
        <span className="hidden max-w-[11rem] truncate font-mono text-[0.68rem] text-faint xl:block">
          {email ?? "Signed in"}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="press grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { accounts } = useDashboard();
  return (
    <div className="flex h-full flex-col gap-7 px-4 py-5">
      <Link to="/dashboard" className="px-1" onClick={onNavigate}>
        <SocialPulseLogo />
      </Link>
      <NavGroup items={NAV} onNavigate={onNavigate} />
      <NavGroup title="Sources" items={NAV_SOURCES} onNavigate={onNavigate} />
      <div className="mt-auto space-y-5">
        <div className="px-3">
          <p className="label-faint">Tracked presences</p>
          <p className="figure mt-1 text-2xl">{accounts.length}</p>
        </div>
        <NavGroup items={NAV_FOOTER} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [...NAV, NAV_SOURCES[0]] as const;
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 flex items-stretch border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map(({ to, label, icon: Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            aria-label={label}
            className={cn(
              "relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 font-mono text-[0.55rem] uppercase tracking-[0.1em] transition-colors",
              active ? "text-primary" : "text-faint",
            )}
          >
            {active ? <span className="absolute inset-x-4 top-0 h-[2px] rounded-b bg-primary" /> : null}
            <Icon size={17} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fieldRef = usePointerField();

  return (
    <div ref={fieldRef} className="signal-wash grain min-h-screen">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
          <div className="sticky top-0 h-screen">
            <SidebarBody />
          </div>
        </aside>

        {menuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="animate-fade absolute inset-0 bg-background/80 backdrop-blur-sm"
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
          <TopBar onOpenMenu={() => setMenuOpen(true)} onOpenCommand={() => setCommandOpen(true)} />
          <main className="mx-auto w-full max-w-[104rem] flex-1 px-4 pb-24 pt-7 md:px-8 md:pb-16 md:pt-9">
            <div key={pathname} className="page-enter">
              {children}
            </div>
          </main>

        </div>
      </div>
      <BottomNav />
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return <ShellInner>{children}</ShellInner>;
}

/** Standard content gutter. Pages compose their own rhythm inside it. */
export function Section({
  children,
  className,
  bleed = false,
}: {
  children: ReactNode;
  className?: string;
  bleed?: boolean;
}) {
  return (
    <section className={cn("mx-auto w-full max-w-[104rem]", bleed ? "px-0" : "px-4 md:px-8", className)}>
      {children}
    </section>
  );
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
    <Section className="border-b border-border py-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <h1 className="font-display text-[1.75rem] font-semibold tracking-[-0.03em] md:text-[2.1rem]">{title}</h1>
          {description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </Section>
  );
}
