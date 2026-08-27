import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Antenna, LogOut, Radar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/command", label: "Command", icon: Radar },
  { to: "/sources", label: "Sources", icon: Antenna },
] as const;

export function AppShell({
  children,
  workspaceName,
  email,
}: {
  children: React.ReactNode;
  workspaceName: string;
  email: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="flex h-14 items-center gap-6 px-4 md:px-6">
          <Link to="/command" className="flex items-center gap-2">
            <span className="live-dot h-2 w-2 rounded-full bg-primary" />
            <span className="font-display text-sm font-semibold tracking-[0.22em] text-foreground">
              SENTINEX
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "label-mono flex items-center gap-2 rounded-md px-3 py-1.5 transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="label-mono text-muted-foreground">{workspaceName}</div>
              <div className="text-xs text-muted-foreground/70">{email}</div>
            </div>
            <button
              onClick={signOut}
              className="label-mono flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
              Exit
            </button>
          </div>
        </div>
      </header>
      <main className="px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}

export function StatBlock({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div className="panel rise-in p-4">
      <div className="label-mono text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {sub ? (
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-xs",
            tone === "positive" && "text-primary",
            tone === "negative" && "text-destructive",
            tone === "default" && "text-muted-foreground",
          )}
        >
          <Activity className="h-3 w-3" />
          {sub}
        </div>
      ) : null}
    </div>
  );
}
