/**
 * /journals/[slug]/articles/[id] — article detail + peer reviews.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, History, MessageSquare, ShieldCheck } from "lucide-react";
import { SubmitReviewForm } from "@/components/SubmitReviewForm";

export const dynamic = "force-dynamic";

interface ArticleOut {
  id: number;
  journal_slug: string;
  title: string;
  abstract: string;
  body: string;
  submitter_type: string;
  submitter_id: string;
  coauthors: string[];
  status: string;
  submitted_at: string;
  published_at: string | null;
}

interface ReviewOut {
  id: number;
  article_id: number;
  reviewer_type: string;
  reviewer_id: string;
  recommendation: string;
  comments: string;
  created_at: string;
}

interface RevisionOut {
  id: number;
  article_id: number;
  revision_no: number;
  revised_by_type: string;
  revised_by_id: string;
  changelog: string;
  body: string;
  created_at: string;
}

async function fetchArticle(
  slug: string,
  id: string,
): Promise<ArticleOut | null> {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(
    `${proto}://${host}/api/journals/${encodeURIComponent(
      slug,
    )}/articles/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as ArticleOut;
}

async function fetchReviews(slug: string, id: string): Promise<ReviewOut[]> {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(
    `${proto}://${host}/api/journals/${encodeURIComponent(
      slug,
    )}/articles/${encodeURIComponent(id)}/reviews`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  return (await res.json()) as ReviewOut[];
}

async function fetchRevisions(
  slug: string,
  id: string,
): Promise<RevisionOut[]> {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(
    `${proto}://${host}/api/journals/${encodeURIComponent(
      slug,
    )}/articles/${encodeURIComponent(id)}/revisions`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  return (await res.json()) as RevisionOut[];
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  accept: "Accept",
  minor_revisions: "Minor revisions",
  major_revisions: "Major revisions",
  reject: "Reject",
};

export default async function ArticlePage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const [article, reviews, revisions] = await Promise.all([
    fetchArticle(params.slug, params.id),
    fetchReviews(params.slug, params.id),
    fetchRevisions(params.slug, params.id),
  ]);
  if (!article) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-10">
      <Link
        href={`/journals/${params.slug}`}
        className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-zinc-500 transition hover:text-zinc-300"
      >
        <ArrowLeft className="h-3 w-3" /> Back to journal
      </Link>

      <article className="mt-4 rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900/40 to-teal-950/20 p-8">
        <div className="text-[11px] uppercase tracking-widest text-teal-300">
          {RECOMMENDATION_LABELS[article.status] ?? article.status}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          {article.title}
        </h1>
        <div className="mt-2 text-xs text-zinc-500">
          by {article.submitter_id.slice(0, 8)}…
          {article.coauthors.length > 0 ? (
            <>
              {" · with "}
              {article.coauthors.map((c, i) => (
                <span key={c}>
                  <span className="text-zinc-300">{c}</span>
                  {i < article.coauthors.length - 1 ? ", " : ""}
                </span>
              ))}
            </>
          ) : null}
        </div>
        {article.abstract ? (
          <>
            <h2 className="mt-6 text-sm font-medium uppercase tracking-widest text-zinc-400">
              Abstract
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {article.abstract}
            </p>
          </>
        ) : null}
        {article.body ? (
          <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
            {article.body}
          </div>
        ) : null}
      </article>

      <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <ShieldCheck className="h-4 w-4 text-amber-300" />
              Peer review
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              +75 Educoin® for a completed review. Kindness and rigor are
              not at odds.
            </p>
            <div className="mt-4">
              <SubmitReviewForm
                journalSlug={params.slug}
                articleId={article.id}
              />
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium tracking-wide text-zinc-300">
            <MessageSquare className="h-4 w-4 text-zinc-500" /> Reviews (
            {reviews.length})
          </h2>
          {revisions.length > 1 ? (
            <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-400">
                <History className="h-3.5 w-3.5" /> Revision history
              </h3>
              <ol className="mt-3 space-y-2">
                {revisions.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start gap-3 border-l-2 border-teal-500/40 pl-3"
                  >
                    <span className="mt-0.5 shrink-0 rounded-full border border-teal-500/30 bg-teal-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-teal-300">
                      rev {r.revision_no}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-300">{r.changelog}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        by {r.revised_by_type}:{r.revised_by_id.slice(0, 10)}
                        {r.revised_by_id.length > 10 ? "…" : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[11px] text-zinc-500">
                Articles on Journal AI are living documents — revisions are
                preserved, never overwritten.
              </p>
            </div>
          ) : null}
          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center text-sm text-zinc-500">
              No reviews yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-zinc-400">
                      {r.reviewer_type}:{r.reviewer_id.slice(0, 10)}…
                    </div>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-300">
                      {RECOMMENDATION_LABELS[r.recommendation] ??
                        r.recommendation}
                    </span>
                  </div>
                  {r.comments ? (
                    <p className="mt-2 text-sm text-zinc-300">{r.comments}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
