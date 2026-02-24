"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
};

type PublicHeaderProps = {
  navItems: NavItem[];
  ctaHref: string;
  ctaLabel: string;
};

export default function PublicHeader({ navItems, ctaHref, ctaLabel }: PublicHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-wide text-cyan-300">
          S-Trends
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-slate-300 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-white">
              {item.label}
            </Link>
          ))}
          <Link
            href={ctaHref}
            className="rounded-lg border border-cyan-300/40 bg-cyan-400/15 px-3 py-2 font-semibold text-cyan-100 hover:bg-cyan-400/25"
          >
            {ctaLabel}
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 p-2 text-slate-200 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open ? (
        <div className="absolute top-full right-0 left-0 z-20 mt-3 rounded-2xl border border-white/10 bg-[#0b1724] p-3 shadow-2xl md:hidden">
          <div className="flex flex-col gap-2 text-sm text-slate-200">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={ctaHref}
              onClick={() => setOpen(false)}
              className="mt-1 rounded-lg border border-cyan-300/40 bg-cyan-400/15 px-3 py-2 font-semibold text-cyan-100 hover:bg-cyan-400/25"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
