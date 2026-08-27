import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SENTINEX — Social intelligence from official APIs" },
      {
        name: "description",
        content:
          "SENTINEX collects data from official X, YouTube, TikTok and Instagram APIs, normalizes it into one event model, and surfaces evidence-backed sentiment, topics, trends and anomalies.",
      },
      { property: "og:title", content: "SENTINEX — Social intelligence from official APIs" },
      {
        property: "og:description",
        content:
          "Evidence-backed sentiment, topic momentum and anomaly detection across official social platform APIs.",
      },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    k: "01",
    t: "Official APIs only",
    d: "Every record is collected through a documented platform API with explicit capability metadata. No scraping, no invented metrics.",
  },
  {
    k: "02",
    t: "Unified event model",
    d: "Posts, comments and metric snapshots from every provider normalize into one schema with per-field provenance.",
  },
  {
    k: "03",
    t: "Deterministic analytics",
    d: "Sentiment, TF-IDF topic clustering, velocity and median/MAD anomaly detection — each result links back to source records.",
  },
];

function Landing() {
  return (
    <div className="grid-lines min-h-screen">
      <header className="flex h-14 items-center justify-between border-b border-border/70 px-6">
        <div className="flex items-center gap-2">
          <span className="live-dot h-2 w-2 rounded-full bg-primary" />
          <span className="font-display text-sm font-semibold tracking-[0.22em]">SENTINEX</span>
        </div>
        <Link
          to="/auth"
          className="label-mono rounded-md border border-border px-3 py-1.5 hover:border-primary/50"
        >
          Access terminal
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="label-mono text-primary">Social intelligence platform</div>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight text-foreground md:text-6xl">
          Evidence-backed intelligence from the platforms that matter.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground">
          Collect from official X, YouTube, TikTok and Instagram APIs. Normalize into a single
          event model. Detect sentiment shifts, emerging narratives and statistical anomalies —
          every number traceable to the records that produced it.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            to="/auth"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Open the console
          </Link>
        </div>

        <div className="mt-20 grid gap-3 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.k} className="panel rise-in p-5">
              <div className="label-mono text-primary">{p.k}</div>
              <h2 className="mt-3 font-display text-base font-semibold text-foreground">{p.t}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
