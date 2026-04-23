"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Sparkles, LogIn, LogOut, User } from "lucide-react";

export function Nav() {
  const { data: session, status } = useSession();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/20">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white">sof<span className="text-indigo-400">.ai</span></span>
          <span className="ml-2 hidden rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 sm:inline-block">
            School of AI
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/learn"
            className="text-sm text-zinc-300 transition hover:text-white"
          >
            Learn
          </Link>
          <a
            href="https://www.curriki.org"
            target="_blank"
            rel="noreferrer"
            className="hidden text-sm text-zinc-400 transition hover:text-white sm:inline-block"
          >
            About
          </a>
          {status === "loading" ? (
            <div className="h-8 w-20 animate-pulse rounded-md bg-zinc-800" />
          ) : user ? (
            <div className="flex items-center gap-3">
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
