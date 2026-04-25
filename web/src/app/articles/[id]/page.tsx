/**
 * /articles/{id} — single Living-Article view.
 *
 * Shows the article body, the multi-agent review pipeline timeline (with
 * each round's reviewer + summary), and an Approve button visible only
 * to Dr. Cheteni when the article is in `awaiting_approval`.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ApproveArticleButton } from "@/components/ApproveArticleButton";

export const dynamic = "force-dynamic";

interface ArticleAuthor {
  type: "user" | "agent";
  id: string;
  display_name: string;
}

interface ReviewRound {
  id: number;
  round_no: number;
  phase: string;
  reviewer_type: string;
  reviewer_id: string;
  summary: string;
  body: string;
  accepted: boolean;
  created_at: string;
}

interface ArticleDetail {
  id: number;
  journal_slug: string;
  title: string;
  abstract: string;
  body: string;
  primary_author: ArticleAuthor;
  coauthors: ArticleAuthor[];
  pipeline_phase: string;
  status: string;
  source_session_id: string | null;
  pipeline_started_at: string | null;
  pipeline_completed_at: string | null;
  submitted_at: string;
  published_at: string | null;
  reviews: ReviewRound[];
}

const PIPELINE_ORDER = [
  "drafted",
  "claude_review_1",
  "devin_review_1",
  "claude_review_2",
  "gemini_review",
  "devin_final",
  "awaiting_approval",
  "approved",
  "published",
] as const;

const PHASE_LABEL: Record<string, string> = {
  drafted: "Drafted",
  claude_review_1: "Claude · Aesthetics + accuracy",
  devin_review_1: "Devin · Code + dependency audit",
  claude_review_2: "Claude · Final pass",
  gemini_review: "Gemini · Visuals + virality",
  devin_final: "Devin · Final review",
  awaiting_approval: "Awaiting Dr. Cheteni",
  approved: "Approved",
  published: "Published",
};

async function fetchArticle(id: string): Promise<ArticleDetail | null> {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  try {
    const res = await fetch(`${proto}://${host}/api/articles/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ArticleDetail;
  } catch {
    return null;
  }
}

export default async function ArticleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const article = await fetchArticle(params.id);
  if (!article) notFound();

  const currentIdx = PIPELINE_ORDER.indexOf(
    article.pipeline_phase as (typeof PIPELINE_ORDER)[number],
  );

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-10">
      <p className="text-xs uppercase tracking-widest text-zinc-500">
        <Link
          href="/articles"
          className="text-emerald-300 hover:underline"
        >
          ← Living Articles
        </Link>{" "}
        · {article.journal_slug}
      </p>

      <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
        {article.title}
      </h1>

      <p className="mt-4 text-sm text-zinc-400">
        Authors:{" "}
        {[article.primary_author, ...article.coauthors]
          .map((a, i) => `${i + 1}. ${a.display_name || a.id}`)
          .join("  ·  ")}
      </p>

      {/* Pipeline timeline */}
      <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
          Review pipeline
        </h2>
        <ol className="mt-4 space-y-2">
          {PIPELINE_ORDER.map((phase, idx) => {
            const isPast = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const round = article.reviews.find((r) => r.phase === phase);
            return (
              <li
                key={phase}
                className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
                  isCurrent
                    ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-100"
                    : isPast
                      ? "border-zinc-800 bg-zinc-900/40 text-zinc-300"
                      : "border-zinc-800 bg-zinc-900/20 text-zinc-500"
                }`}
              >
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    isPast || isCurrent
                      ? "bg-emerald-500/30 text-emerald-100"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                  aria-hidden
                >
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{PHASE_LABEL[phase]}</p>
                  {round && (
                    <p className="mt-1 text-xs text-zinc-400">
                      {round.summary || `Reviewed by ${round.reviewer_id}`}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Approve gate */}
      {article.pipeline_phase === "awaiting_approval" && (
        <section className="mt-8 rounded-2xl border border-orange-500/40 bg-orange-500/10 p-6">
          <h2 className="text-lg font-semibold text-orange-100">
            Awaiting Dr. Cheteni&apos;s approval
          </h2>
          <p className="mt-2 text-sm text-orange-200/80">
            The multi-agent pipeline is finished. Dr. Cheteni — and only
            Dr. Cheteni — can approve this article for publication. Once
            approved it auto-publishes to {article.journal_slug} and (in
            PR #12) cross-posts to X / LinkedIn / Substack / Medium.
          </p>
          <div className="mt-4">
            <ApproveArticleButton articleId={article.id} />
          </div>
        </section>
      )}

      {/* Body */}
      <section className="mt-10 prose prose-invert max-w-none">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
          Article body
        </h2>
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-200">
          {article.body || "(empty draft — pipeline will fill this in)"}
        </pre>
      </section>

      {/* Review notes */}
      {article.reviews.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
            Reviewer notes
          </h2>
          <div className="mt-4 space-y-4">
            {article.reviews.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <p className="flex items-center justify-between text-sm font-semibold text-zinc-200">
                  <span>
                    Round {r.round_no} · {r.reviewer_id}{" "}
                    <span className="text-xs font-normal text-zinc-500">
                      ({PHASE_LABEL[r.phase] ?? r.phase})
                    </span>
                  </span>
                  <time
                    className="text-xs font-normal text-zinc-500"
                    dateTime={r.created_at}
                  >
                    {new Date(r.created_at).toLocaleString()}
                  </time>
                </p>
                {r.summary && (
                  <p className="mt-1 text-sm text-zinc-400">{r.summary}</p>
                )}
                {r.body && (
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-300">
                    {r.body}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
