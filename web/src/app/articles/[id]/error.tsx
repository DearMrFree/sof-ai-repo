"use client";

/**
 * Error boundary for /articles/{id}. If the server-side fetch (or any
 * downstream component) throws, the user lands here instead of seeing
 * a Next.js raw error overlay or a 500 page that requires a hard reload.
 *
 * Critically: Dr. Cheteni's review-chain run can take 60-180s, and any
 * transient blip during that window must NOT lose the article — it's
 * already persisted on the backend. The Retry button below just refreshes
 * the page; the article state is recovered from FastAPI on the next load.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function ArticleErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("articles/[id] error boundary:", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-16 text-center">
      <p className="text-xs uppercase tracking-widest text-zinc-500">
        <Link href="/articles" className="text-emerald-300 hover:underline">
          ← Living Articles
        </Link>
      </p>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
        We hit a snag rendering this article
      </h1>
      <p className="mt-3 text-sm text-zinc-400">
        Your article and review history are safe on the backend — this is
        just a render error in your browser. Try again, or head back to the
        index. If it keeps happening, share this error digest with Devin:
      </p>
      <pre className="mt-3 inline-block rounded-md bg-zinc-900 px-3 py-1 text-xs text-zinc-500">
        {error.digest ?? "no-digest"}
      </pre>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400"
        >
          Try again
        </button>
        <Link
          href="/articles"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          Back to articles
        </Link>
      </div>
    </main>
  );
}
