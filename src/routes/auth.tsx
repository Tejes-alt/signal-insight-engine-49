import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · SocialPulse" },
      {
        name: "description",
        content:
          "Sign in to SocialPulse to track followers, engagement and top content across Instagram, YouTube, TikTok, LinkedIn, Facebook and X.",
      },
      { property: "og:title", content: "Sign in · SocialPulse" },
      {
        property: "og:description",
        content: "Your social media analytics, unified in one dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

const FIELD =
  "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("If that address has a SocialPulse account, a reset link is on its way.");
        return;
      }

      if (mode === "signup") {
        if (password !== confirm) {
          toast.error("Those passwords don't match.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: name },
          },
        });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await supabase
            .from("profiles")
            .upsert({ id: data.session.user.id, email, display_name: name });
          navigate({ to: "/dashboard", replace: true });
        } else {
          setSent("Almost there — check your inbox to confirm your email address.");
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(
        /invalid login/i.test(message)
          ? "That email and password don't match."
          : message || "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in didn't complete. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  const title =
    mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password";

  return (
    <div className="aurora grain relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden>
        <span className="absolute left-1/2 top-1/2 size-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15 halo-ring" />
        <span
          className="absolute left-1/2 top-1/2 size-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10 halo-ring"
          style={{ animationDelay: "1.8s" }}
        />
      </div>
      <div className="panel gradient-border animate-rise relative w-full max-w-md p-7 sm:p-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to SocialPulse
        </Link>
        <div className="mt-6 flex flex-col leading-none">
          <span className="font-display text-[0.66rem] font-semibold tracking-[0.34em] text-muted-foreground">SOCIAL</span>
          <span className="gradient-text font-display text-2xl font-bold tracking-[0.16em]">PULSE</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Your social intelligence, in one place.</p>
        <h1 className="mt-5 font-display text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {mode === "forgot"
            ? "Enter your SocialPulse email and we'll send you a link to choose a new password."
            : "This password is for SocialPulse only. We never ask for your social media passwords."}
        </p>

        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-foreground">{sent}</p>
            <button
              onClick={() => {
                setSent(null);
                setMode("signin");
              }}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            {mode !== "forgot" ? (
              <>
                <button
                  onClick={google}
                  disabled={busy}
                  className="mt-6 w-full rounded-xl border border-border bg-secondary/50 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  Continue with Google
                </button>
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
                    or
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </>
            ) : null}

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" ? (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={FIELD}
                    placeholder="Alex Rivera"
                  />
                </div>
              ) : null}
              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={FIELD}
                  placeholder="you@example.com"
                />
              </div>
              {mode !== "forgot" ? (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={FIELD}
                  />
                </div>
              ) : null}
              {mode === "signup" ? (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="confirm">
                    Confirm password
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={FIELD}
                  />
                </div>
              ) : null}
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
              </button>
            </form>

            <div className="mt-5 flex flex-col gap-2 text-center text-xs font-medium text-muted-foreground">
              {mode === "signin" ? (
                <>
                  <button className="hover:text-foreground" onClick={() => setMode("forgot")}>
                    Forgot your password?
                  </button>
                  <button className="hover:text-foreground" onClick={() => setMode("signup")}>
                    No account? Create one
                  </button>
                </>
              ) : (
                <button className="hover:text-foreground" onClick={() => setMode("signin")}>
                  Already have an account? Sign in
                </button>
              )}
            </div>
          </>
        )}

        <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
          SocialPulse only reads information your profiles already publish openly. Private analytics stay locked
          until you authorize a platform yourself.
        </p>
      </div>
    </div>
  );
}
