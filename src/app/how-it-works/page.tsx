import Link from "next/link";

const steps = [
  {
    id: "01",
    title: "Create Your Account",
    description:
      "Sign up, log in, and open your dashboard. Free users can start immediately.",
  },
  {
    id: "02",
    title: "Pick Country + Topic View",
    description:
      "Select a country, then switch between All Topics, Hashtags, Regular, and Fast Rising.",
  },
  {
    id: "03",
    title: "Use Trends Quickly",
    description:
      "Copy trend strings or post directly to X. Use fresh scans to update your view.",
  },
  {
    id: "04",
    title: "Manage Your Workspace",
    description:
      "Update your profile/KYC details, monitor usage, and review notifications from one place.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[#07101b] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-10 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-wide text-cyan-300">
            S-Trends
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-slate-300 hover:text-white">
              Home
            </Link>
            <Link href="/pricing" className="text-slate-300 hover:text-white">
              Pricing
            </Link>
            <Link
              href="/auth?mode=register"
              className="rounded-lg border border-cyan-300/40 bg-cyan-400/15 px-3 py-2 font-semibold text-cyan-100 hover:bg-cyan-400/25"
            >
              Get Started
            </Link>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/15 via-sky-400/10 to-blue-500/10 p-7">
          <div className="pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full bg-cyan-300/15 blur-3xl" />
          <p className="text-xs font-semibold tracking-[0.2em] text-cyan-200 uppercase">How It Works</p>
          <h1 className="mt-3 text-3xl font-bold">Go from trend discovery to posting in minutes</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-200">
            S-Trends is built for fast decisions: discover country-level trend signals, choose your
            preferred topic mode, and execute quickly.
          </p>
        </section>

        <section className="mt-7 grid gap-4 md:grid-cols-2">
          {steps.map((step) => (
            <article
              key={step.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
            >
              <p className="text-xs font-semibold tracking-[0.2em] text-cyan-200 uppercase">
                Step {step.id}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">{step.title}</h2>
              <p className="mt-2 text-sm text-slate-300">{step.description}</p>
            </article>
          ))}
        </section>

        <section className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/auth?mode=register"
            className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300"
          >
            Create Free Account
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-white/10"
          >
            Open Dashboard
          </Link>
        </section>
      </div>
    </div>
  );
}
