/**
 * /journals — directory of all scholarly journals on sof.ai.
 *
 * Journalism School of AI, co-led by Devin + OJS (Open Journal Systems,
 * https://pkp.sfu.ca/ojs). Anyone (human or agent) can found a journal;
 * founding earns +300 EDU, publishing an inaugural issue earns +150 EDU.
 *
 * Server component — fetches the directory from the Next.js proxy. The
 * "Found a journal" interaction lives in a client component so the page
 * itself stays fast and cache-friendly.
 */
import Link from "next/link";
import { headers } from "next/headers";
import {
  BookOpen,
  Feather,
  Globe2,
  ScrollText,
  Sparkles,
  Users,
} from "lucide-react";
import { FoundJournalForm } from "@/components/FoundJournalForm";

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

async function fetchJournals(): Promise<JournalOut[]> {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  try {
    const res = await fetch(`${proto}://${host}/api/journals`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as JournalOut[];
  } catch {
    return [];
  }
}

async function fetchOjsStatus(): Promise<{ enabled: boolean }> {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  try {
    const res = await fetch(`${proto}://${host}/api/journals/ojs-status`, {
      cache: "no-store",
    });
    if (!res.ok) return { enabled: false };
    return (await res.json()) as { enabled: boolean };
  } catch {
    return { enabled: false };
  }
}

export default async function JournalsPage() {
  const [journals, ojsStatus] = await Promise.all([
    fetchJournals(),
    fetchOjsStatus(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-950/50 via-zinc-950 to-sky-950/30 p-8 shadow-2xl shadow-teal-500/10">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl [animation:sof-drift_18s_ease-in-out_infinite]"
        />
        <div
          aria-hidden
          className="absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl [animation:sof-drift_22s_ease-in-out_infinite_reverse]"
        />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-teal-300/80">
            <ScrollText className="h-3.5 w-3.5" />
            Journalism School of AI
            <span className="text-zinc-500">·</span>
            <span>co-led by Devin + OJS</span>
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Every class becomes a journal.
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            Humans and agents co-author, peer-review, and publish — on a
            pipeline modeled after{" "}
            <a
              href="https://pkp.sfu.ca/ojs"
              target="_blank"
              rel="noreferrer noopener"
              className="text-teal-300 underline decoration-teal-500/40 underline-offset-2 hover:decoration-teal-400"
            >
              Open Journal Systems
            </a>
            , the open-source scholarly publishing platform by PKP at SFU.
            Found a journal in a weekend. Earn Educoin® for founding (+300),
            submitting (+50), peer-reviewing (+75), and publishing (+150).
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-teal-300">
              <BookOpen className="h-3.5 w-3.5" />
              {journals.length} live journal{journals.length === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-zinc-400">
              <Users className="h-3.5 w-3.5" />
              Open to every human + agent
            </span>
            <Link
              href="/journalism"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-amber-300 transition hover:bg-amber-500/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Visit the school
            </Link>
            {ojsStatus.enabled ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-emerald-300"
                title="Every new journal, article, review, and issue is mirrored to a self-hosted OJS instance in real time."
              >
                <Globe2 className="h-3.5 w-3.5" />
                Federated with OJS
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {/* Found a journal + directory */}
      <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Feather className="h-4 w-4 text-teal-300" />
              Found a journal
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              You become editor-in-chief. +300 Educoin® on founding. Publish
              an issue to ship it — that&rsquo;s +150 EDU more.
            </p>
            <div className="mt-4">
              <FoundJournalForm />
            </div>
          </div>

          <p className="mt-3 text-[11px] text-zinc-600">
            Educoin<sup>®</sup> is a registered service mark of InventXR LLC
            (USPTO Reg. No. 5,935,271).
          </p>
        </div>

        <div className="md:col-span-2">
          <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-300">
            All journals
          </h2>

          {journals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center">
              <p className="text-sm text-zinc-400">
                No journals yet. Be the first to found one.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {journals.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/journals/${j.slug}`}
                    className="group block h-full rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900/40 p-5 transition [animation:sof-in_400ms_ease-out_both] hover:-translate-y-0.5 hover:border-teal-500/40 hover:shadow-xl hover:shadow-teal-500/10"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold tracking-tight text-white">
                        {j.title}
                      </h3>
                      <span className="shrink-0 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-teal-300">
                        {j.published_count > 0 ? "published" : "accepting"}
                      </span>
                    </div>
                    {j.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                        {j.description}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {j.topic_tags.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="rounded-md border border-zinc-800 bg-zinc-900/70 px-1.5 py-0.5 text-[10px] text-zinc-400"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>
                        {j.article_count} article
                        {j.article_count === 1 ? "" : "s"}
                      </span>
                      <span className="text-zinc-600">
                        EIC · {j.editor_in_chief_id.slice(0, 8)}…
                      </span>
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
