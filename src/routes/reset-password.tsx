import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password · SocialPulse" },
      {
        name: "description",
        content: "Set a new password for your SocialPulse analytics account.",
      },
      { property: "og:title", content: "Choose a new password · SocialPulse" },
      { property: "og:description", content: "Set a new password for your SocialPulse account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setReady(true);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Those passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't update your password. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="aurora flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel gradient-border animate-rise w-full max-w-md p-8">
        <h1 className="font-display text-2xl font-bold">Choose a new password</h1>
        {ready ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick something you haven't used elsewhere. This password is for SocialPulse only.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="pw">
                  New password
                </label>
                <input
                  id="pw"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="pw2">
                  Confirm new password
                </label>
                <input
                  id="pw2"
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Update password
              </button>
            </form>
          </>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              This page opens from the reset link we email you. Request a new link if this one has expired.
            </p>
            <Link
              to="/auth"
              className="inline-block rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
