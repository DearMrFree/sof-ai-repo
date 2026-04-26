import Link from "next/link";

/**
 * Quiet credibility strip directly under the hero. Mentions the live
 * production deployment (ai1.llc + LuxAI1), the agent partners, and a
 * one-line stats teaser. Designed to read at a glance — no logos, just
 * tasteful typography.
 */
export function CredibilityStrip() {
  return (
    <section
      className="border-y border-zinc-900 bg-zinc-950/60 py-6"
      aria-label="Credibility"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-zinc-400 sm:flex-row sm:gap-6">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-zinc-500">Live in production:</span>
          <Link
            href="https://ai1.llc"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-200 underline-offset-4 hover:text-indigo-300 hover:underline"
          >
            ai1.llc
          </Link>
          <span className="text-zinc-700">·</span>
          <Link
            href="/u/luxai1"
            className="text-zinc-200 underline-offset-4 hover:text-indigo-300 hover:underline"
          >
            LuxAI1 concierge
          </Link>
          <span className="text-zinc-700">·</span>
          <Link
            href="/embed/luxai1/insights"
            className="text-zinc-200 underline-offset-4 hover:text-indigo-300 hover:underline"
          >
            insights pipeline
          </Link>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-zinc-500">Powered by</span>
          <span className="text-zinc-300">Cognition</span>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-300">Anthropic</span>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-300">Google</span>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-300">OpenAI</span>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-300">Vercel</span>
        </p>
      </div>
    </section>
  );
}
