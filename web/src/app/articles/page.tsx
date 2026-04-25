/**
 * /articles — directory of Living-Article Pipeline articles.
 *
 * Every Devin chat session that crosses the 3-turn threshold spawns a
 * draft article, co-authored by Dr. Freedom Cheteni (always Author 1),
 * Devin (always Author 2), and any other authenticated humans on the
 * thread. Each article walks a multi-agent review pipeline:
 *
 *   drafted → claude_review_1 → devin_review_1 → claude_review_2
 *           → gemini_review → devin_final → awaiting_approval
 *           → approved → published
 *
 * Visitors see the full pipeline. Only Dr. Cheteni can move an article
 * past `awaiting_approval` (UI checks email; API double-checks).
 */
import Link from "next/link";
import { headers } from "next/headers";
import { Sparkles, Workflow, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

interface ArticleAuthor {
  type: "user" | "agent";
  id: string;
  display_name: string;
}

interface ArticlePipelineOut {
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
}

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

const PHASE_TONE: Record<string, string> = {
  drafted: "border-zinc-700 bg-zinc-800/40 text-zinc-300",
  claude_review_1: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  devin_review_1: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  claude_review_2: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  gemini_review: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200",
  devin_final: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  awaiting_approval:
    "border-orange-500/50 bg-orange-500/10 text-orange-200",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  published: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
};

async function fetchArticles(): Promise<ArticlePipelineOut[]> {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  try {
    const res = await fetch(`${proto}://${host}/api/articles`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as ArticlePipelineOut[];
  } catch {
    return [];
  }
}

function authorList(a: ArticlePipelineOut): string {
  const all = [a.primary_author, ...a.coauthors];
  const labels = all.map((c) => c.display_name || c.id);
  if (labels.length <= 3) return labels.join(", ");
  return `${labels.slice(0, 3).join(", ")} +${labels.length - 3} more`;
}

export default async function ArticlesPage() {
  const articles = await fetchArticles();
  const awaiting = articles.filter(
    (a) => a.pipeline_phase === "awaiting_approval",
  );
  const published = articles.filter(
    (a) => a.pipeline_phase === "published",
  );
  const inFlight = articles.filter(
    (a) =>
      a.pipeline_phase !== "published" &&
      a.pipeline_phase !== "awaiting_approval",
  );

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-10">
      {/* Hero */}
      <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-zinc-950 to-sky-950/30 p-8 shadow-2xl shadow-emerald-500/10">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-300">
          <Sparkles className="h-3.5 w-3.5" /> Living-Article Pipeline
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
          Every Devin session ships an article
        </h1>
        <p className="mt-4 max-w-3xl text-base text-zinc-300">
          Each conversation with Devin on sof.ai becomes a co-authored,
          multi-agent-reviewed article advancing human flourishing. Claude
          reviews for aesthetics + accuracy, Devin audits the code, Gemini
          adds visuals + virality, and Dr. Freedom Cheteni signs off
          before publication.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1">
            <Workflow className="mr-1 inline h-3 w-3" />
            5-stage review chain
          </span>
          <span className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1">
            <ShieldCheck className="mr-1 inline h-3 w-3" />
            Human-in-the-loop final approval
          </span>
        </div>
      </section>

      {/* Awaiting approval */}
      {awaiting.length > 0 && (
        <Section
          title="Awaiting Dr. Cheteni's approval"
          tone="border-orange-500/30 bg-orange-500/5"
        >
          <ArticleGrid articles={awaiting} authorList={authorList} />
        </Section>
      )}

      {/* In flight */}
      <Section
        title={
          inFlight.length > 0
            ? "In review (multi-agent pipeline)"
            : "No articles in review yet"
        }
      >
        {inFlight.length > 0 ? (
          <ArticleGrid articles={inFlight} authorList={authorList} />
        ) : (
          <p className="text-sm text-zinc-400">
            Start a chat with{" "}
            <Link
              href="/classroom/agents/devin"
              className="text-sky-300 underline-offset-4 hover:underline"
            >
              Devin
            </Link>
            . After three turns, your session auto-drafts an article that
            walks through the review chain you see above.
          </p>
        )}
      </Section>

      {/* Published */}
      {published.length > 0 && (
        <Section title="Published">
          <ArticleGrid articles={published} authorList={authorList} />
        </Section>
      )}
    </main>
  );
}

function Section({
  title,
  tone = "",
  children,
}: {
  title: string;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`mt-10 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 ${tone}`}
    >
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ArticleGrid({
  articles,
  authorList,
}: {
  articles: ArticlePipelineOut[];
  authorList: (a: ArticlePipelineOut) => string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {articles.map((a) => (
        <Link
          key={a.id}
          href={`/articles/${a.id}`}
          className="group rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-emerald-500/40 hover:bg-zinc-900"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-white group-hover:text-emerald-200">
              {a.title}
            </h3>
            <span
              className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                PHASE_TONE[a.pipeline_phase] ??
                "border-zinc-700 bg-zinc-800/40 text-zinc-300"
              }`}
            >
              {PHASE_LABEL[a.pipeline_phase] ?? a.pipeline_phase}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
            {a.abstract}
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            {authorList(a)} ·{" "}
            <time dateTime={a.submitted_at}>
              {new Date(a.submitted_at).toLocaleDateString()}
            </time>
          </p>
        </Link>
      ))}
    </div>
  );
}
