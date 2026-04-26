/**
 * /embed/{slug}/trainer — Blajon's training console (PR #34).
 *
 * Closes the LuxAI1 → sof.ai feedback loop:
 *   conversations → insights → THIS PAGE → live system prompt
 *
 * The trainer types a capability proposal (or arrives here pre-filled
 * from a "Propose capability" click on the insights console). The
 * proposal flows through the Claude/Devin/Gemini review chain. If
 * approved, the literal proposed text is folded into LuxAI1's system
 * prompt at the next request — no redeploy of either ai1.llc or
 * sof.ai required.
 *
 * Gated to the agent's owner + lead professors. Public-read of the
 * applied notes happens via /api/embed/{slug}/mentor-notes/active —
 * that endpoint is intentionally unauthenticated because the applied
 * text IS the agent's published voice; gating it would block the
 * customer chat path.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Undo2,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { canViewAgent, ownerEmailFor } from "@/lib/embed/conversations";
import { getApiBaseUrl } from "@/lib/apiBase";
import { ProposeMentorNoteForm } from "@/components/ProposeMentorNoteForm";
import { RetractMentorNoteButton } from "@/components/RetractMentorNoteButton";

export const dynamic = "force-dynamic";

type NoteStatus =
  | "pending"
  | "reviewing"
  | "applied"
  | "rejected"
  | "retracted";

interface ReviewRound {
  reviewer_id: string;
  verdict: string;
  summary: string;
  body: string;
  recorded_at: string;
}

interface MentorNote {
  id: number;
  agent_slug: string;
  proposed_by_email: string;
  proposed_at: string;
  status: NoteStatus;
  proposed_text: string;
  applied_text: string;
  applied_at: string | null;
  reviewer_chain: ReviewRound[];
  source_insight_id: number | null;
  rejection_reason: string;
}

interface MentorNoteListResponse {
  items: MentorNote[];
  total: number;
  by_status: Record<string, number>;
}

async function loadList(slug: string): Promise<MentorNoteListResponse | null> {
  const url = `${getApiBaseUrl()}/embed/${slug}/mentor-notes?limit=100`;
  const headersInit: Record<string, string> = {};
  if (process.env.INTERNAL_API_KEY) {
    headersInit["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  const res = await fetch(url, { headers: headersInit, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as MentorNoteListResponse;
}

const STATUS_META: Record<
  NoteStatus,
  {
    label: string;
    cls: string;
    Icon: React.ComponentType<{ className?: string }>;
    description: string;
  }
> = {
  pending: {
    label: "Pending",
    cls: "bg-zinc-50 text-zinc-700 border-zinc-200",
    Icon: Clock,
    description: "Just proposed; review chain hasn't started.",
  },
  reviewing: {
    label: "Reviewing",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    Icon: Clock,
    description: "At least one reviewer voted; more to go.",
  },
  applied: {
    label: "Applied · live",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: CheckCircle2,
    description: "Folded into the agent's live system prompt.",
  },
  rejected: {
    label: "Rejected",
    cls: "bg-rose-50 text-rose-700 border-rose-200",
    Icon: XCircle,
    description: "A reviewer blocked it; never shipped.",
  },
  retracted: {
    label: "Retracted",
    cls: "bg-violet-50 text-violet-700 border-violet-200",
    Icon: Undo2,
    description: "Trainer pulled it back after it shipped.",
  },
};

function reviewerChip(reviewer_id: string, verdict: string): string {
  const approve = verdict === "approve";
  const base =
    "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium whitespace-nowrap";
  if (approve) return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
  return `${base} bg-rose-50 text-rose-700 border-rose-200`;
}

function relTime(iso: string): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diffMin = Math.floor((Date.now() - ts) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function TrainerConsolePage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from_insight?: string; suggested?: string }>;
}) {
  const { slug } = await props.params;
  const { from_insight, suggested } = await props.searchParams;

  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!canViewAgent(slug, email)) {
    if (!email) {
      const h = await headers();
      const host = h.get("host") ?? "sof.ai";
      const proto = h.get("x-forwarded-proto") ?? "https";
      const callback = encodeURIComponent(
        `${proto}://${host}/embed/${slug}/trainer`,
      );
      redirect(`/api/auth/signin?callbackUrl=${callback}`);
    }
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-lg font-semibold text-amber-900">
            Not authorized
          </h1>
          <p className="mt-2 text-sm text-amber-800">
            This trainer console is restricted to the agent&apos;s owner and
            its lead professors at sof.ai.
          </p>
          <p className="mt-3 text-xs text-amber-700">
            Signed in as {email}. Owner email on file:{" "}
            <code>{ownerEmailFor(slug) || "(unset)"}</code>.
          </p>
        </div>
      </div>
    );
  }

  const data = await loadList(slug);

  const sourceInsightId = from_insight ? Number.parseInt(from_insight, 10) : null;
  // Next.js automatically decodes searchParams. Decoding again would throw
  // URIError on natural-language text with bare `%` characters and silently
  // corrupt strings like "%50" — see Devin Review on PR #35.
  const initialText = suggested ?? "";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-violet-600" />
          {slug.toUpperCase()} — trainer console
        </h1>
        <p className="mt-2 text-zinc-600 max-w-2xl">
          Propose a new capability for {slug.toUpperCase()}. Claude, Devin, and
          Gemini auto-review for safety and brand voice. If all three approve,
          your literal text folds into the agent&apos;s live system prompt —
          new visitors on https://ai1.llc see the change within 5 minutes.
        </p>
        <div className="mt-3 text-sm flex gap-4 flex-wrap">
          <Link
            href={`/embed/${slug}/insights`}
            className="text-emerald-700 hover:text-emerald-900 underline-offset-4 hover:underline"
          >
            ← Insights
          </Link>
          <Link
            href={`/embed/${slug}/conversations`}
            className="text-emerald-700 hover:text-emerald-900 underline-offset-4 hover:underline"
          >
            All conversations
          </Link>
        </div>
      </div>

      <ProposeMentorNoteForm
        slug={slug}
        initialText={initialText}
        sourceInsightId={
          sourceInsightId && Number.isFinite(sourceInsightId)
            ? sourceInsightId
            : null
        }
      />

      {data && (
        <div className="mt-8 mb-4 flex flex-wrap items-center gap-2">
          {(Object.keys(STATUS_META) as NoteStatus[]).map((s) => {
            const meta = STATUS_META[s];
            const count = data.by_status[s] ?? 0;
            const Icon = meta.Icon;
            return (
              <span
                key={s}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium ${meta.cls}`}
                title={meta.description}
              >
                <Icon className="h-3.5 w-3.5" />
                {meta.label}: <strong>{count}</strong>
              </span>
            );
          })}
        </div>
      )}

      {!data ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-800 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">Couldn&apos;t reach the API.</div>
            <div className="text-sm mt-1">
              Try refreshing — if this persists, the FastAPI backend may be
              temporarily down.
            </div>
          </div>
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-zinc-600">
          <Sparkles className="h-8 w-8 mx-auto text-zinc-400" />
          <p className="mt-3">No mentor notes yet — propose your first above.</p>
          <p className="mt-2 text-xs text-zinc-500">
            Tip: open an insight on the{" "}
            <Link href={`/embed/${slug}/insights`} className="underline">
              insights console
            </Link>{" "}
            and click &ldquo;Propose capability&rdquo; to pre-fill this form.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.items.map((note) => {
            const meta = STATUS_META[note.status] ?? STATUS_META.pending;
            const Icon = meta.Icon;
            return (
              <li
                key={note.id}
                className="rounded-lg border border-zinc-200 bg-white shadow-sm"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium whitespace-nowrap ${meta.cls}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                      <span className="text-xs text-zinc-500">
                        proposed {relTime(note.proposed_at)} by{" "}
                        <code className="text-zinc-700">
                          {note.proposed_by_email}
                        </code>
                      </span>
                      {note.source_insight_id != null && (
                        <Link
                          href={`/embed/${slug}/insights`}
                          className="text-xs text-emerald-700 hover:underline"
                        >
                          ← from insight #{note.source_insight_id}
                        </Link>
                      )}
                    </div>
                    {note.status === "applied" && (
                      <RetractMentorNoteButton slug={slug} noteId={note.id} />
                    )}
                  </div>

                  <div className="text-sm text-zinc-900 whitespace-pre-wrap">
                    {note.proposed_text}
                  </div>

                  {note.status === "applied" &&
                    note.applied_text &&
                    note.applied_text !== note.proposed_text && (
                      <div className="mt-3 text-xs">
                        <div className="font-medium text-emerald-700">
                          Applied as (after review):
                        </div>
                        <div className="text-zinc-700 whitespace-pre-wrap mt-1">
                          {note.applied_text}
                        </div>
                      </div>
                    )}

                  {note.rejection_reason && (
                    <div className="mt-3 text-xs text-rose-700">
                      <span className="font-medium">Rejection reason:</span>{" "}
                      {note.rejection_reason}
                    </div>
                  )}

                  {note.reviewer_chain.length > 0 && (
                    <details className="mt-3 group">
                      <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-900 select-none">
                        Review chain ({note.reviewer_chain.length}{" "}
                        {note.reviewer_chain.length === 1
                          ? "round"
                          : "rounds"}
                        )
                      </summary>
                      <div className="mt-2 space-y-2">
                        {note.reviewer_chain.map((round, i) => (
                          <div
                            key={`${round.reviewer_id}-${i}`}
                            className="rounded border border-zinc-200 p-3 bg-zinc-50"
                          >
                            <div className="flex items-center gap-2 text-xs mb-1">
                              <span
                                className={reviewerChip(
                                  round.reviewer_id,
                                  round.verdict,
                                )}
                              >
                                {round.reviewer_id} · {round.verdict}
                              </span>
                              <span className="text-zinc-500">
                                {relTime(round.recorded_at)}
                              </span>
                            </div>
                            {round.summary && (
                              <div className="text-xs text-zinc-700 mb-1">
                                {round.summary}
                              </div>
                            )}
                            {round.body && (
                              <div className="text-xs text-zinc-600 whitespace-pre-wrap">
                                {round.body}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
