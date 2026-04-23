/**
 * /journals/[slug] — journal detail page.
 *
 * Shows masthead, scope, topic tags, editor-in-chief, and a paginated list
 * of articles (submitted / under_review / accepted / published / rejected).
 * Signed-in learners can submit a paper inline.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  CircleDashed,
  Eye,
  FileText,
  UserRound,
} from "lucide-react";
import { SubmitArticleForm } from "@/components/SubmitArticleForm";

export const dynamic = "force-dynamic";

interface JournalOut {
  id: number;
  slug: string;
  title: string;
  description: string;
  topic_tags: string[];
  editor_in_chief_type: string;
  editor_in_chief_id: string;
  created_at: string;
  article_count: number;
  published_count: number;
}

interface ArticleOut {
  id: number;
  journal_slug: string;
  title: string;
  abstract: string;
  submitter_type: string;
  submitter_id: string;
  coauthors: string[];
  status: string;
  submitted_at: string;
  published_at: string | null;
}

async function fetchJournal(slug: string): Promise<JournalOut | null> {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(
    `${proto}://${host}/api/journals/${encodeURIComponent(slug)}`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as JournalOut;
}

async function fetchArticles(slug: string): Promise<ArticleOut[]> {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(
    `${proto}://${host}/api/journals/${encodeURIComponent(slug)}/articles`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  return (await res.json()) as ArticleOut[];
}

function StatusPill({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    submitted: {
      label: "Submitted",
      className:
        "border-zinc-700/80 bg-zinc-900/70 text-zinc-300",
      Icon: FileText,
    },
    under_review: {
      label: "Under review",
      className:
        "border-amber-500/30 bg-amber-500/10 text-amber-300",
      Icon: Eye,
    },
    accepted: {
      label: "Accepted",
      className: "border-sky-500/30 bg-sky-500/10 text-sky-300",
      Icon: CheckCircle2,
    },
    published: {
      label: "Published",
      className:
        "border-teal-500/30 bg-teal-500/10 text-teal-300",
      Icon: CheckCircle2,
    },
    rejected: {
      label: "Rejected",
      className: "border-zinc-700/80 bg-zinc-950 text-zinc-500",
      Icon: CircleDashed,
    },
  };
  const entry = map[status] ?? map.submitted;
  const Icon = entry.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${entry.className}`}
    >
      <Icon className="h-3 w-3" />
      {entry.label}
    </span>
  );
}

export default async function JournalPage({
  params,
}: {
  params: { slug: string };
}) {
  const journal = await fetchJournal(params.slug);
  if (!journal) notFound();

  const articles = await fetchArticles(params.slug);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-10">
      {/* Masthead */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900/40 to-teal-950/40 p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Link
              href="/journals"
              className="text-xs uppercase tracking-widest text-zinc-500 transition hover:text-zinc-300"
            >
              ← All journals
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {journal.title}
            </h1>
            {journal.description ? (
              <p className="mt-2 max-w-2xl text-zinc-400">
                {journal.description}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {journal.topic_tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-300"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-center">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">
              Editor-in-Chief
            </div>
            <div className="mt-1 flex items-center justify-center gap-1.5 text-sm text-white">
              <UserRound className="h-3.5 w-3.5" />
              {journal.editor_in_chief_id.slice(0, 8)}…
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] text-zinc-400">
              <div>
                <div className="text-lg font-semibold text-white">
                  {journal.article_count}
                </div>
                articles
              </div>
              <div>
                <div className="text-lg font-semibold text-white">
                  {journal.published_count}
                </div>
                published
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <FileText className="h-4 w-4 text-teal-300" />
              Submit a paper
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              +50 Educoin® on submission, +120 EDU if it&rsquo;s published.
              Agent co-authors welcome.
            </p>
            <div className="mt-4">
              <SubmitArticleForm journalSlug={journal.slug} />
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-300">
            Articles
          </h2>
          {articles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center">
              <BookOpen className="mx-auto h-6 w-6 text-zinc-600" />
              <p className="mt-2 text-sm text-zinc-400">
                No submissions yet. Be the first author to contribute.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {articles.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/journals/${journal.slug}/articles/${a.id}`}
                    className="group block rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 transition hover:-translate-y-0.5 hover:border-teal-500/40 hover:shadow-lg hover:shadow-teal-500/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-white transition group-hover:text-teal-200">
                          {a.title}
                        </h3>
                        {a.abstract ? (
                          <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                            {a.abstract}
                          </p>
                        ) : null}
                        <div className="mt-2 text-[11px] text-zinc-500">
                          by {a.submitter_id.slice(0, 8)}…
                          {a.coauthors.length > 0
                            ? ` · with ${a.coauthors.length} co-author${
                                a.coauthors.length === 1 ? "" : "s"
                              }`
                            : ""}
                        </div>
                      </div>
                      <StatusPill status={a.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
