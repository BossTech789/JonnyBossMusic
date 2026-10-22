
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

const adminLinks = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Songs", href: "/admin/songs" },
  { label: "Videos", href: "/admin/videos" },
  { label: "SmartLinks", href: "/admin/smartlinks" },
  { label: "Newsletter", href: "/admin/newsletter" },
];

export default function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await signOut(auth);
      router.replace("/admin/login");
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  }

  return (
    <aside className="flex w-full flex-col border-b border-[#56301f] bg-[#120906] text-[#f5eee8] md:min-h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
      <div className="border-b border-[#3d1f14] px-6 py-7">
        <Link
          href="/admin/dashboard"
          className="text-xl font-black uppercase tracking-[0.15em] text-[#a97955]"
        >
          Jonny Boss
        </Link>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#c9b9ae]">
          Admin Panel
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 p-4 md:flex-1 md:flex-col md:gap-2 md:p-5">
        {adminLinks.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/admin/dashboard" &&
              pathname.startsWith(`${link.href}/`));

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-[#70432c] text-white"
                  : "text-[#c9b9ae] hover:bg-[#2b140d] hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#3d1f14] p-4 md:p-5">
        <Link
          href="/"
          className="mb-3 block rounded-lg px-4 py-3 text-sm text-[#c9b9ae] transition hover:bg-[#2b140d] hover:text-white"
        >
          View Website
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-lg border border-[#56301f] px-4 py-3 text-left text-sm font-semibold text-[#f5eee8] transition hover:bg-[#3d1f14]"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
