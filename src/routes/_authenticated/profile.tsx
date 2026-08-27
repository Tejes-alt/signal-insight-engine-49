import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, LogOut, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useDashboard } from "@/hooks/dashboard-context";
import { getProfile, saveProfileName, deleteMyAccount } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORMS } from "@/lib/social/platforms";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile · SocialPulse" },
      { name: "description", content: "Manage your SocialPulse name, password and account data." },
      { property: "og:title", content: "Your profile · SocialPulse" },
      { property: "og:description", content: "Manage your SocialPulse account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const FIELD =
  "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring";

function ProfilePage() {
  const { email, accounts } = useDashboard();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profileFn = useServerFn(getProfile);
  const saveFn = useServerFn(saveProfileName);
  const deleteFn = useServerFn(deleteMyAccount);

  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (profileQuery.data?.profile?.display_name) setName(profileQuery.data.profile.display_name);
  }, [profileQuery.data]);

  const saveName = useMutation({
    mutationFn: (displayName: string) => saveFn({ data: { displayName } }),
    onSuccess: () => {
      toast.success("Name updated.");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => toast.error("We couldn't save that right now. Please try again."),
  });

  const changePassword = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
    },
    onSuccess: () => {
      setPassword("");
      toast.success("Password updated.");
    },
    onError: () => toast.error("We couldn't update your password. Please try again."),
  });

  const removeAccount = useMutation({
    mutationFn: () => deleteFn(),
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    },
    onError: () => toast.error("We couldn't delete your account right now. Please try again."),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (name || email || "S").slice(0, 1).toUpperCase();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-center gap-4">
          <span
            className="grid size-14 place-items-center rounded-2xl font-display text-xl font-bold text-background"
            style={{ background: "var(--gradient-brand)" }}
          >
            {initials}
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{name || "Your profile"}</h1>
            <p className="text-sm text-muted-foreground">{email ?? ""}</p>
          </div>
          <Button variant="secondary" className="ml-auto" onClick={signOut}>
            <LogOut className="mr-1.5 size-4" /> Log out
          </Button>
        </header>

        <section className="panel p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <UserRound className="size-4 text-primary" /> Your details
          </h2>
          <label className="mt-4 block text-xs font-semibold text-muted-foreground" htmlFor="name">
            Name
          </label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
          <label className="mt-4 block text-xs font-semibold text-muted-foreground" htmlFor="email">
            Email
          </label>
          <input id="email" value={email ?? ""} readOnly disabled className={`${FIELD} opacity-60`} />
          <Button
            className="mt-4"
            disabled={!name.trim() || saveName.isPending}
            onClick={() => saveName.mutate(name.trim())}
          >
            {saveName.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </section>

        <section className="panel p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <ShieldCheck className="size-4 text-primary" /> Security
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This password signs you into SocialPulse only — never into a social platform.
          </p>
          <label className="mt-4 block text-xs font-semibold text-muted-foreground" htmlFor="pw">
            New password
          </label>
          <input
            id="pw"
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD}
          />
          <Button
            className="mt-4"
            variant="secondary"
            disabled={password.length < 8 || changePassword.isPending}
            onClick={() => changePassword.mutate(password)}
          >
            {changePassword.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Update password
          </Button>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Tracked accounts</h2>
          {accounts.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">You haven't added any social accounts yet.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {accounts.map((a) => (
                <li
                  key={a.id}
                  className="rounded-full border border-border px-3 py-1.5 text-sm font-medium"
                  style={{ color: PLATFORMS[a.platform].accent }}
                >
                  {PLATFORMS[a.platform].name} · {a.handle}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel border-destructive/40 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-destructive">
            <Trash2 className="size-4" /> Delete account
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This permanently removes your SocialPulse account, your tracked handles and every stored snapshot.
            It cannot be undone.
          </p>
          {confirmDelete ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="destructive" disabled={removeAccount.isPending} onClick={() => removeAccount.mutate()}>
                {removeAccount.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                Yes, delete everything
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="destructive" className="mt-4" onClick={() => setConfirmDelete(true)}>
              Delete my account
            </Button>
          )}
        </section>
      </div>
    </AppShell>
  );
}
