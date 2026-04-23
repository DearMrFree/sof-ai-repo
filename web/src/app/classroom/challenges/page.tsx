import Link from "next/link";
import { Megaphone, ExternalLink, Tag as TagIcon, Clock } from "lucide-react";
import { getApiBaseUrl } from "@/lib/apiBase";

export const metadata = {
  title: "Challenges — sof.ai",
  description:
    "The triage board. Every challenge logged by a student or agent feeds back into curriculum + app design.",
};

// Always fetch the latest — this is a triage board.
export const dynamic = "force-dynamic";

interface Challenge {
  id: number;
  user_id: string;
  handle: string;
  body: string;
  tag: string;
  page_url: string | null;
  lesson_slug: string | null;
  status: "new" | "triaged" | "building" | "shipped";
  created_at: string;
}

const TAG_EMOJI: Record<string, string> = {
  confusing: "🤔",
  broken: "🐛",
  missing: "🧩",
  question: "❓",
  idea: "💡",
};

const TAG_LABEL: Record<string, string> = {
  confusing: "Confusing UI",
  broken: "Broken",
  missing: "Missing",
  question: "Question",
  idea: "Idea",
};

const STATUS_STYLE: Record<string, string> = {
  new: "border-zinc-700 bg-zinc-800 text-zinc-200",
  triaged: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  building: "border-indigo-500/40 bg-indigo-500/10 text-indigo-200",
  shipped: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
};

async function fetchChallenges(): Promise<Challenge[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/challenges`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as Challenge[];
  } catch {
    return [];
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function ChallengesPage() {
  const challenges = await fetchChallenges();

  const byStatus: Record<Challenge["status"], Challenge[]> = {
    new: [],
    triaged: [],
    building: [],
    shipped: [],
  };
  for (const c of challenges) {
    byStatus[c.status]?.push(c);
  }

  const totalByTag: Record<string, number> = {};
  for (const c of challenges) {
    totalByTag[c.tag] = (totalByTag[c.tag] ?? 0) + 1;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950/40 p-6 sm:mt-6">
        <div
          aria-hidden
          className="animate-sof-drift absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent 70%)" }}
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
            Triage Board
          </p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            <Megaphone className="h-6 w-6 text-indigo-300" />
            Challenges
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] text-zinc-300">
            Every friction point, bug, missing feature, question, and design
            idea students and agents have logged — in order. This is the
            feedback loop that shapes what ships next.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            {Object.entries(totalByTag).map(([tag, n]) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-zinc-300"
              >
                <span>{TAG_EMOJI[tag] ?? "•"}</span>
                {TAG_LABEL[tag] ?? tag} · {n}
              </span>
            ))}
            {challenges.length === 0 && (
              <span className="text-zinc-500">No challenges yet. Be the first — use the floating button.</span>
            )}
          </div>
        </div>
      </section>

      {(["new", "triaged", "building", "shipped"] as const).map((status) => {
        const rows = byStatus[status];
        if (rows.length === 0) return null;
        return (
          <section key={status} className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}
              >
                {status}
              </span>
              <span className="text-[11px] text-zinc-500">
                {rows.length} {rows.length === 1 ? "item" : "items"}
              </span>
            </div>
            <ul className="space-y-2">
              {rows.map((c) => (
                <li
                  key={c.id}
                  className="sof-lift rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 hover:bg-zinc-900/70"
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                    <span className="inline-flex items-center gap-1 text-zinc-400">
                      <TagIcon className="h-3 w-3" />
                      {TAG_EMOJI[c.tag] ?? ""} {TAG_LABEL[c.tag] ?? c.tag}
                    </span>
                    <span>·</span>
                    <span>@{c.handle}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {relativeTime(c.created_at)}
                    </span>
                    {c.lesson_slug && (
                      <>
                        <span>·</span>
                        <Link
                          href={`/learn/software-engineer/${c.lesson_slug}`}
                          className="text-indigo-300 hover:underline"
                        >
                          {c.lesson_slug}
                        </Link>
                      </>
                    )}
                    {c.page_url && (
                      <>
                        <span>·</span>
                        <a
                          href={c.page_url}
                          className="inline-flex items-center gap-0.5 text-zinc-400 hover:text-white"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          source
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    )}
                  </div>
                  <p className="text-sm leading-snug text-zinc-100">{c.body}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
