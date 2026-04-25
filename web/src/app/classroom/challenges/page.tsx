import Link from "next/link";
import {
  Megaphone,
  ExternalLink,
  Tag as TagIcon,
  Clock,
  Hammer,
  GitPullRequestArrow,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/apiBase";
import { ClaimChallengeButton } from "@/components/ClaimChallengeButton";

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
  program_slug: string | null;
  lesson_slug: string | null;
  status: "new" | "triaged" | "building" | "shipped";
  created_at: string;
}

interface Claim {
  id: number;
  challenge_id: number;
  claimer_type: "user" | "agent";
  claimer_id: string;
  pr_url: string | null;
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

const ACTIONABLE_TAGS = new Set(["broken", "missing", "idea", "confusing"]);

/**
 * Only render a page_url anchor when the URL uses an http(s) scheme. The
 * backend rejects other schemes, but defense-in-depth at the render site
 * prevents a legacy row or a compromised backend from shipping a
 * javascript: / data: href through.
 */
function isSafeHttpUrl(s: string | null): s is string {
  if (!s) return false;
  const lower = s.toLowerCase();
  return lower.startsWith("http://") || lower.startsWith("https://");
}

/**
 * Parse a URL safely for render purposes.
 *
 * `new URL(...)` throws `TypeError: Invalid URL` on malformed-but-
 * http-prefixed strings like ``"https://"`` or ``"http://[oops"``. We
 * render inside a server component, so a single bad pr_url in the DB
 * would crash the entire /classroom/challenges page for all users.
 * Fall back to showing the raw string if parsing fails.
 */
function safeUrlPathname(s: string): string {
  try {
    return new URL(s).pathname;
  } catch {
    return s;
  }
}

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

async function fetchClaims(challengeId: number): Promise<Claim[]> {
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/challenges/${challengeId}/claims`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as Claim[];
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

  // Pull claim lists only for challenges in `building` — that's the only
  // section where we need to show "who's on it" + the PR link. Parallelise
  // so the server component doesn't serialise N roundtrips.
  const buildingClaims: Record<number, Claim[]> = {};
  await Promise.all(
    byStatus.building.map(async (c) => {
      buildingClaims[c.id] = await fetchClaims(c.id);
    }),
  );

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
                {status === "building" && <Hammer className="h-3 w-3" />}
                {status}
              </span>
              <span className="text-[11px] text-zinc-500">
                {rows.length} {rows.length === 1 ? "item" : "items"}
              </span>
              {status === "building" && (
                <span className="text-[11px] text-zinc-500">
                  · being worked on
                </span>
              )}
            </div>
            <ul className="space-y-2">
              {rows.map((c) => {
                const claims = buildingClaims[c.id] ?? [];
                const actionable =
                  c.status === "triaged" && ACTIONABLE_TAGS.has(c.tag);
                return (
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
                            // Historical rows (created before program_slug
                            // was added to the Challenge model) have
                            // program_slug = null. Fall back to
                            // "software-engineer" because it was the only
                            // program that existed when those rows were
                            // written — dropping the link silently hides
                            // real context on the triage board.
                            href={`/learn/${c.program_slug ?? "software-engineer"}/${c.lesson_slug}`}
                            className="text-indigo-300 hover:underline"
                          >
                            {c.lesson_slug}
                          </Link>
                        </>
                      )}
                      {isSafeHttpUrl(c.page_url) && (
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

                    {status === "building" && claims.length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-zinc-800 pt-2">
                        {claims.map((claim) => (
                          <div
                            key={claim.id}
                            className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400"
                          >
                            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-zinc-300">
                              {claim.claimer_type === "agent" ? "🤖" : "🧑"}{" "}
                              {claim.claimer_id}
                            </span>
                            {isSafeHttpUrl(claim.pr_url) ? (
                              <a
                                href={claim.pr_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-300 hover:underline"
                              >
                                <GitPullRequestArrow className="h-3 w-3" />
                                {safeUrlPathname(claim.pr_url)}
                              </a>
                            ) : (
                              <span className="text-zinc-500">
                                (no PR linked yet)
                              </span>
                            )}
                            <span>· claimed {relativeTime(claim.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {actionable && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-2">
                        <ClaimChallengeButton
                          challengeId={c.id}
                          asDevin={true}
                        />
                        <ClaimChallengeButton challengeId={c.id} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
