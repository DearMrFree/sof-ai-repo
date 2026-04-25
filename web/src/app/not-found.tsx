/**
 * Top-level 404. Renders when a route doesn't match anything in the
 * app router. Keeps the user inside the sof.ai shell with one-click
 * paths to the highest-traffic destinations (classroom, articles,
 * journals).
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-16 text-center">
      <p className="text-xs uppercase tracking-widest text-zinc-500">
        sof.ai · 404
      </p>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
        That page doesn&apos;t exist (yet).
      </h1>
      <p className="mt-3 text-sm text-zinc-400">
        Either the URL is wrong, the article was renamed, or you&apos;re
        catching us in the middle of building it. Try one of these:
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400"
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
          Living Articles
        </Link>
        <Link
          href="/journals"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          Journals
        </Link>
      </div>
    </main>
  );
}
