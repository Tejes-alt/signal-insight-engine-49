import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  LayoutDashboard,
  Link2,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Upload,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/hooks/dashboard-context";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  group: "Navigation" | "Analytics" | "Actions" | "Account";
  icon: typeof Search;
  shortcut?: string;
  run: () => void | Promise<void>;
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refreshAll, accounts } = useDashboard();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const go = useCallback(
    (to: string) => () => {
      onClose();
      void navigate({ to });
    },
    [navigate, onClose],
  );

  const commands = useMemo<Command[]>(
    () => [
      { id: "overview", label: "Go to Overview", group: "Navigation", icon: LayoutDashboard, run: go("/dashboard") },
      { id: "analytics", label: "Go to Analytics", group: "Navigation", icon: BarChart3, run: go("/analytics") },
      { id: "content", label: "Go to Content", group: "Navigation", icon: Play, run: go("/content") },
      { id: "insights", label: "Go to Insights", group: "Navigation", icon: Sparkles, run: go("/insights") },
      { id: "accounts", label: "Go to Accounts", group: "Navigation", icon: Link2, run: go("/accounts") },
      { id: "import", label: "Import Analytics", group: "Analytics", icon: Upload, shortcut: "I", run: go("/import") },
      { id: "add", label: "Add Social Account", group: "Analytics", icon: Plus, shortcut: "A", run: go("/accounts") },
      {
        id: "refresh",
        label: accounts.length === 0 ? "Refresh Data" : "Refresh All Profiles",
        group: "Actions",
        icon: RefreshCw,
        shortcut: "R",
        run: async () => {
          onClose();
          await refreshAll();
        },
      },
      { id: "settings", label: "Settings", group: "Account", icon: Settings, run: go("/settings") },
      { id: "profile", label: "Profile", group: "Account", icon: UserRound, run: go("/profile") },
      {
        id: "logout",
        label: "Log out",
        group: "Account",
        icon: LogOut,
        run: async () => {
          onClose();
          queryClient.clear();
          await supabase.auth.signOut();
          void navigate({ to: "/auth", replace: true });
        },
      },
    ],
    [go, refreshAll, onClose, navigate, queryClient, accounts.length],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      const id = window.setTimeout(() => inputRef.current?.focus(), 20);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  const grouped = results.reduce<Record<string, Command[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <button
        aria-label="Close command palette"
        className="animate-fade absolute inset-0 bg-background/70 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        className="glass animate-rise relative w-full max-w-xl overflow-hidden rounded-2xl shadow-[var(--shadow-raised)]"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => (i + 1) % Math.max(results.length, 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => (i - 1 + results.length) % Math.max(results.length, 1));
          }
          if (e.key === "Enter") {
            e.preventDefault();
            void results[index]?.run();
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search SocialPulse…"
            aria-label="Search commands"
            className="h-13 w-full bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing matches that.</p>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-1">
                <p className="label-mono px-3 py-2">{group}</p>
                {items.map((c) => {
                  const i = results.indexOf(c);
                  const active = i === index;
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.id}
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => void c.run()}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                        active ? "bg-secondary/80 text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("size-4", active && "text-primary")} />
                      <span className="flex-1 font-medium">{c.label}</span>
                      {c.shortcut ? <span className="kbd">{c.shortcut}</span> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
