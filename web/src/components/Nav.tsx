"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Sparkles, LogIn, LogOut, User, GraduationCap, Users, Newspaper, ClipboardList, UserCircle2, School, Wallet as WalletIcon, BookOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { EducoinChip } from "@/components/EducoinChip";

const navLinks = [
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/classroom", label: "Classroom", icon: Users },
  { href: "/classroom/feed", label: "Feed", icon: Newspaper },
  { href: "/classroom/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/schools", label: "Schools", icon: School },
  { href: "/journals", label: "Journals", icon: BookOpen },
  { href: "/u", label: "People", icon: UserCircle2 },
  { href: "/wallet", label: "Wallet", icon: WalletIcon },
];

export function Nav() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-white">
              sof<span className="text-indigo-400">.ai</span>
            </span>
          </Link>

          <div className="hidden items-center gap-0.5 md:flex">
            {(() => {
              const matches = navLinks.filter(
                (link) =>
                  pathname === link.href ||
                  (link.href !== "/" && pathname?.startsWith(link.href + "/")),
              );
              const bestHref = matches.length
                ? matches.reduce((a, b) => (a.href.length >= b.href.length ? a : b)).href
                : null;
              return navLinks.map((l) => {
              const Icon = l.icon;
              const active = l.href === bestHref;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "group relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-white",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {l.label}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400 transition-all",
                      active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
                    )}
                  />
                </Link>
              );
            });
            })()}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {status === "loading" ? (
            <div className="h-8 w-20 animate-pulse rounded-md bg-zinc-800" />
          ) : user ? (
            <div className="flex items-center gap-2">
              {(user as { id?: string }).id ? (
                <EducoinChip
                  ownerType="user"
                  ownerId={(user as { id?: string }).id as string}
                />
              ) : null}
              <div className="hidden items-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 sm:flex">
                <User className="h-3.5 w-3.5" />
                {user.name ?? user.email}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/signin"
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-400"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
