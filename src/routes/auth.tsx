import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { MarkWatermark, SocialPulseLogo } from "@/components/brand";
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
  "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-faint focus:border-primary/70";


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
    <div className="grain grid min-h-screen lg:grid-cols-[1.05fr_minmax(26rem,0.95fr)]">
      {/* Brand side — the mark at architectural scale over the pulse grid */}
      <aside className="pulse-grid relative hidden overflow-hidden border-r border-border bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <SocialPulseLogo animate />
        <div className="relative">
          <MarkWatermark className="absolute -left-16 -top-24 opacity-[0.07]" />
          <h2 className="relative max-w-md font-display text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.035em]">
            Every number here was actually measured.
          </h2>
          <p className="relative mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            SocialPulse reads what your profiles publish openly, stores each reading with its date and source, and
            calculates growth from those readings alone. Nothing is estimated, nothing is invented.
          </p>
        </div>
        <div className="relative flex items-center gap-6">
          {["No social passwords", "No API keys", "No demo data"].map((item) => (
            <span key={item} className="label-faint flex items-center gap-2">
              <span className="size-1 rounded-full bg-primary" />
              {item}
            </span>
          ))}
        </div>
      </aside>

      {/* Form side */}
      <div className="relative flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="animate-rise w-full max-w-sm">
          <Link
            to="/"
            className="label-faint inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back
          </Link>
          <div className="mt-7 lg:hidden">
            <SocialPulseLogo />
          </div>
          <h1 className="mt-6 font-display text-[1.9rem] font-semibold tracking-[-0.03em]">{title}</h1>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            {mode === "forgot"
              ? "Enter your SocialPulse email and we'll send you a link to choose a new password."
              : "This password is for SocialPulse only. We never ask for your social media passwords."}
          </p>


        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-md border border-border bg-secondary/40 p-4 text-sm text-foreground">{sent}</p>
            <button
              onClick={() => {
                setSent(null);
                setMode("signin");
              }}
              className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
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
                  className="mt-6 w-full rounded-md border border-border bg-secondary/50 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
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
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
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

          <p className="mt-7 flex items-start gap-2 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            SocialPulse only reads information your profiles already publish openly. Private analytics stay locked
            until you authorize a platform yourself.
          </p>
        </div>
      </div>
    </div>

  );
}
