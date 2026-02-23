import Link from "next/link";

const features = [
  {
    title: "Live Trend Discovery",
    description:
      "Track country-specific X trends in real time and switch by hashtag or regular topic view.",
  },
  {
    title: "Fast Content Workflow",
    description:
      "Copy, share, and convert trend signals into high-velocity publishing decisions in seconds.",
  },
  {
    title: "Pro Optimizer (Soon)",
    description:
      "AI rewrite recommendations and projected reach scoring are planned for the Pro rollout.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#07101b] text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-bold tracking-wide text-cyan-300">
          Swave
        </Link>
        <nav className="flex items-center gap-5 text-sm text-slate-300">
          <Link href="/pricing" className="hover:text-white">Pricing</Link>
          <Link href="/auth?mode=login" className="hover:text-white">Login</Link>
          <Link
            href="/auth?mode=register"
            className="rounded-lg border border-cyan-300/40 bg-cyan-400/15 px-3 py-2 font-semibold text-cyan-100 hover:bg-cyan-400/25"
          >
            Get Started
          </Link>
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-10 px-6 pb-16 pt-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <p className="mb-3 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-cyan-200 uppercase">
            X Growth Intelligence
          </p>
          <h1 className="text-4xl leading-tight font-bold text-white lg:text-5xl">
            A professional trend intelligence workspace for modern X creators.
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-300">
            Monitor live trends by country, extract high-signal topics, and execute faster posting decisions. Sign up for free and start using the dashboard immediately.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/auth?mode=register"
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300"
            >
              Create Free Account
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-white/10"
            >
              View Pricing
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <p className="mb-5 text-xs font-semibold tracking-[0.2em] text-slate-300 uppercase">
            Product Highlights
          </p>
          <div className="space-y-4">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <h2 className="text-sm font-semibold text-cyan-200">{feature.title}</h2>
                <p className="mt-1 text-sm text-slate-300">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
