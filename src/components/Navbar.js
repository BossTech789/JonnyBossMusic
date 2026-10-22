"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { label: "Home", href: "/" },
  { label: "Music", href: "/music" },
  { label: "Videos", href: "/videos" },
  { label: "Newsletter", href: "/newsletter" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(href) {
    return href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#3d1f14] bg-[#120906]/95 text-[#f5eee8] backdrop-blur-md">
      <nav className="mx-auto flex min-h-[82px] max-w-[1200px] items-center justify-between gap-5 px-5 sm:px-8">
        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          className="shrink-0 text-xl font-black uppercase tracking-[0.18em] text-[#a97955] transition hover:text-[#f5eee8] sm:text-2xl"
        >
          JB
        </Link>

        <div className="hidden items-center justify-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`border-b-2 py-2 text-sm font-semibold transition ${
                isActive(link.href)
                  ? "border-[#a97955] text-[#a97955]"
                  : "border-transparent text-[#c9b9ae] hover:text-[#f5eee8]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <Link
          href="/music"
          className="hidden rounded-lg bg-[#70432c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8d5b3d] md:inline-flex"
        >
          Listen Now
        </Link>

        <button
          type="button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-lg border border-[#56301f] px-4 py-2 text-sm font-semibold text-[#f5eee8] transition hover:bg-[#2b140d] md:hidden"
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </nav>

      {menuOpen && (
        <div className="border-t border-[#3d1f14] bg-[#1c0d08] px-5 py-4 md:hidden">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${
                  isActive(link.href)
                    ? "bg-[#3d1f14] text-[#f5eee8]"
                    : "text-[#c9b9ae] hover:bg-[#2b140d] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <Link
              href="/music"
              onClick={() => setMenuOpen(false)}
              className="mt-2 rounded-lg bg-[#70432c] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-[#8d5b3d]"
            >
              Listen Now
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}