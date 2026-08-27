import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, BarChart3, Eye, Heart, Play, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Logo } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PLATFORM_ACCENT } from "@/components/platform";
import { PROVIDER_LIST } from "@/lib/providers/registry";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pulse — All your social analytics in one dashboard" },
      {
        name: "description",
        content:
          "Pulse brings your YouTube, Instagram, LinkedIn, TikTok, X and Facebook analytics into one beautiful dashboard. Official APIs only — never a platform password.",
      },
      { property: "og:title", content: "Pulse — All your social analytics in one dashboard" },
      {
        property: "og:description",
        content:
          "Followers, reach, engagement and top content across every platform you publish on, in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Users,
    title: "One audience view",
    body: "Followers, reach and growth from every platform combined into a single number you can actually act on.",
    color: "var(--color-chart-1)",
  },
  {
    icon: BarChart3,
    title: "Charts that compare",
    body: "See which platform is carrying your growth and which one has quietly flattened out this month.",
    color: "var(--color-chart-2)",
  },
  {
    icon: Play,
    title: "Content leaderboard",
    body: "Every post, video and reel ranked by views, engagement and engagement rate across platforms.",
    color: "var(--color-chart-3)",
  },
  {
    icon: Sparkles,
    title: "Insights with evidence",
    body: "Each observation states the data it came from. Nothing is invented, nothing is estimated silently.",
    color: "var(--color-chart-4)",
  },
];

const SAMPLE = [
  { label: "Followers", value: "128.4K", delta: "+6.2%", icon: Users },
  { label: "Reach", value: "2.1M", delta: "+11.4%", icon: Eye },
  { label: "Engagements", value: "184K", delta: "+4.8%", icon: Heart },
  { label: "Eng. rate", value: "8.7%", delta: "+0.6%", icon: Activity },
];

function Landing() {
  return (
    <div className="aurora min-h-screen">
      <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between border-x-0 border-t-0 px-5 md:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 text-center md:pt-24">
          <span className="label-mono animate-fade inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5">
            <span className="live-dot" /> Six platforms · one dashboard
          </span>
          <h1 className="animate-rise mx-auto mt-6 max-w-4xl font-display text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl">
            All your social analytics,
            <br />
            <span className="gradient-text">finally in one place.</span>
          </h1>
          <p className="animate-rise mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Connect YouTube, Instagram, LinkedIn, TikTok, X and Facebook through their official
            authorization flows and watch your followers, reach, engagement and best-performing
            content land in one beautiful view.
          </p>
          <div className="animate-rise mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Open my dashboard</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Explore with demo data</Link>
            </Button>
          </div>

          <div className="animate-float mx-auto mt-14 max-w-4xl">
            <div className="panel gradient-border stagger grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
              {SAMPLE.map(({ label, value, delta, icon: Icon }) => (
                <div key={label} className="text-left">
                  <div className="flex items-center justify-between">
                    <span className="label-mono">{label}</span>
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="tabular mt-2 font-display text-2xl font-semibold">{value}</div>
                  <div className="mt-1 text-xs font-semibold text-success">{delta}</div>
                </div>
              ))}
            </div>
            <p className="label-mono mt-3">Illustrative sample figures</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10">
          <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body, color }) => (
              <article key={title} className="panel panel-hover p-5">
                <span
                  className="grid size-10 place-items-center rounded-xl"
                  style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
                >
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-4 font-display text-base font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10">
          <div className="panel flex flex-col items-center gap-6 p-8 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-success/12 text-success">
              <ShieldCheck className="size-6" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold">We never ask for your platform passwords</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Pulse connects only through each platform's official API and authorization screen. You enter your
                handle, approve access on the platform itself, and tokens stay encrypted on our server — revocable at
                any time. When an API doesn't expose a metric, we label it unavailable rather than guessing.
              </p>
            </div>
            <ul className="flex flex-wrap justify-center gap-2">
              {PROVIDER_LIST.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium"
                >
                  <span
                    className="grid size-5 place-items-center rounded-md text-[0.6rem] font-bold"
                    style={{
                      background: `color-mix(in oklab, ${PLATFORM_ACCENT[p.id]} 18%, transparent)`,
                      color: PLATFORM_ACCENT[p.id],
                    }}
                  >
                    {p.mark}
                  </span>
                  {p.name}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h2 className="font-display text-3xl font-bold">See your numbers in under a minute</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Start in demo mode to explore the whole interface, then connect a real account whenever you're ready.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/auth">Get started free</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-8 text-center">
        <p className="label-mono">Pulse · Official platform APIs only</p>
      </footer>
    </div>
  );
}
