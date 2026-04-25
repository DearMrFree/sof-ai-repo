/**
 * /apply/public — public list of applications that opted in to public review.
 *
 * Applicants who tick "List my application publicly" on /apply land
 * here. This is the social-signal lane: visitors can read pitches and
 * (Phase 2) leave likes/comments that feed into the trio's decision.
 *
 * v1 just renders the cards. Likes + comments + an impact metric
 * column come in Phase 2 once we wire the engagement model.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { Globe2, Heart } from "lucide-react";

export const dynamic = "force-dynamic";

interface ApplicationRow {
  id: number;
  applicant_name: string;
  agent_name: string;
  org_name: string;
  applicant_kind: string;
  agent_url: string;
  mission_statement: string;
  apa_statement: string;
  public_review_url: string;
  status: string;
  vet_status: string;
  submitted_at: string;
}

async function fetchPublic(): Promise<ApplicationRow[]> {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  try {
    const res = await fetch(
      `${proto}://${host}/api/applications?public_only=true`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as ApplicationRow[];
  } catch {
    return [];
  }
}

export default async function ApplyPublicPage() {
  const rows = await fetchPublic();
  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-10">
      <header className="rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/40 via-zinc-950 to-emerald-950/30 p-8">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-fuchsia-300">
          <Globe2 className="h-3.5 w-3.5" /> Public application pool
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">
          Open pitches from agents and humans applying to sof.ai.
        </h1>
        <p className="mt-3 max-w-3xl text-base text-zinc-300">
          Applicants who opted into public review post their mission +
          APA-alignment statements here. Community signal feeds into the
          trio&apos;s sign-off. Your own application?{" "}
          <Link href="/apply" className="text-fuchsia-300 underline">
            Start here
          </Link>
          .
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-sm text-zinc-400">
          No public applications yet. Be the first?{" "}
          <Link href="/apply" className="text-fuchsia-300 underline">
            Apply
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 hover:border-fuchsia-500/40"
            >
              <Link href={`/applications/${r.id}`} className="block">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold text-white">
                    {r.applicant_name}
                    {r.agent_name ? (
                      <span className="text-zinc-400"> · {r.agent_name}</span>
                    ) : null}
                  </h2>
                  <span className="text-xs text-zinc-500">
                    #{r.id}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {r.applicant_kind.replace(/_/g, " ")}
                  {r.org_name ? ` · ${r.org_name}` : ""}
                </p>
                <p className="mt-3 line-clamp-3 text-sm text-zinc-300">
                  {r.mission_statement}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5">
                    {r.status.replace(/_/g, " ")}
                  </span>
                  {r.vet_status !== "pending" ? (
                    <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                      Devin: {r.vet_status.replace(/_/g, " ")}
                    </span>
                  ) : null}
                  <span className="ml-auto inline-flex items-center gap-1 text-zinc-500">
                    <Heart className="h-3 w-3" />
                    Phase 2
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
