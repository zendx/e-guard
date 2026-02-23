import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#07101b] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-10 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-wide text-cyan-300">
            Swave
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-slate-300 hover:text-white">Home</Link>
            <Link href="/auth?mode=login" className="text-slate-300 hover:text-white">Login</Link>
          </div>
        </header>

        <h1 className="text-3xl font-bold">Simple plans for creators and growth teams</h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Register and start with the free dashboard today. Pro capabilities are in active development and will launch soon.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-6">
            <p className="text-xs font-semibold tracking-[0.2em] text-cyan-200 uppercase">Free</p>
            <p className="mt-3 text-3xl font-bold">$0</p>
            <p className="mt-1 text-sm text-cyan-100">Perfect for individual users</p>

            <ul className="mt-6 space-y-2 text-sm text-cyan-100">
              <li>- Country-based live trends dashboard</li>
              <li>- Hashtag + regular topic views</li>
              <li>- Copy/share trend workflows</li>
            </ul>

            <Link
              href="/auth?mode=register"
              className="mt-6 inline-flex rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-cyan-200"
            >
              Register Free
            </Link>
          </article>

          <article className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-6">
            <p className="text-xs font-semibold tracking-[0.2em] text-amber-200 uppercase">Pro</p>
            <p className="mt-3 text-3xl font-bold">$19/mo</p>
            <p className="mt-1 text-sm text-amber-100">Coming soon</p>

            <ul className="mt-6 space-y-2 text-sm text-amber-100">
              <li>- AI post optimizer</li>
              <li>- Projected reach scoring</li>
              <li>- Advanced publishing workflows</li>
            </ul>

            <Link
              href="/auth?mode=register&intent=pro"
              className="mt-6 inline-flex rounded-lg border border-amber-200/40 bg-amber-200/15 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-200/25"
            >
              Join Pro Waitlist
            </Link>
          </article>
        </div>
      </div>
    </div>
  );
}
