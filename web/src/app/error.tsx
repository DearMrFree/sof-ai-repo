"use client";

/**
 * Top-level error boundary for the sof.ai web app.
 *
 * Catches any uncaught render or data-fetching error within a route
 * segment that doesn't have its own error.tsx. The Next.js runtime
 * will mount this in place of the failing segment, preserving the
 * root layout (so the user still sees the brand chrome instead of
 * a blank white page).
 *
 * Strategy: never blame the user, never show a stack trace, always
 * give them a recovery path. Most routes here either fetch from
 * FastAPI or call NextAuth — both can be transient.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sof.ai] root error boundary:", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-16 text-center">
      <p className="text-xs uppercase tracking-widest text-zinc-500">
        sof.ai
      </p>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
        We hit an unexpected snag.
      </h1>
      <p className="mt-3 text-sm text-zinc-400">
        Something on this page didn&apos;t load. Your account, articles,
        and chat history are unaffected — this is just a render error.
        Try the page again, or pick a route below.
      </p>
      {error.digest && (
        <pre className="mt-3 inline-block rounded-md bg-zinc-900 px-3 py-1 text-xs text-zinc-500">
          digest: {error.digest}
        </pre>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          Home
        </Link>
        <Link
          href="/classroom"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          Classroom
        </Link>
        <Link
          href="/articles"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          Articles
        </Link>
      </div>
    </main>
  );
}
