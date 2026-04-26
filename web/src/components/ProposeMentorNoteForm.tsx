"use client";

/**
 * Form for proposing a new mentor note in the trainer console.
 *
 * Submits to /api/embed/{slug}/mentor-notes which (a) creates the
 * pending row, then (b) runs the Claude/Devin/Gemini review chain
 * in-band (~10–20s on the happy path) and returns the finalized note.
 * The page is then refreshed via router.refresh() to re-render the
 * server-rendered list with the new row in its terminal state.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  slug: string;
  initialText?: string;
  sourceInsightId?: number | null;
}

export function ProposeMentorNoteForm({
  slug,
  initialText = "",
  sourceInsightId = null,
}: Props) {
  const [text, setText] = useState(initialText);
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomeMsg, setOutcomeMsg] = useState<string | null>(null);
  const router = useRouter();

  const disabled = submitting || !text.trim() || text.length > 2000;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOutcomeMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/embed/${slug}/mentor-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposed_text: text,
          source_insight_id: sourceInsightId,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || `Propose failed (${res.status})`);
      }
      const body = (await res.json()) as {
        outcome?: { finalized_status?: string };
      };
      const fin = body.outcome?.finalized_status ?? "pending";
      if (fin === "applied") {
        setOutcomeMsg("Approved by all reviewers — applied to live agent.");
      } else if (fin === "rejected") {
        setOutcomeMsg("Rejected by review chain — see the new row below.");
      } else {
        setOutcomeMsg(
          "Submitted. Review chain didn't fully complete — see partial chain below.",
        );
      }
      setText("");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <label
        htmlFor="proposed-text"
        className="block text-sm font-medium text-zinc-900 mb-2"
      >
        Propose a capability
      </label>
      <textarea
        id="proposed-text"
        rows={4}
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
        placeholder="e.g. When a visitor mentions a piano, classify the move as specialty_transport and quote a minimum 2-mover crew."
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
        disabled={submitting}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
        <span>{text.length}/2000</span>
        {sourceInsightId != null && (
          <span>
            Linking to insight{" "}
            <code className="text-zinc-700">#{sourceInsightId}</code>.
          </span>
        )}
      </div>
      {error && (
        <div className="mt-3 rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {error}
        </div>
      )}
      {outcomeMsg && !error && (
        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
          {outcomeMsg}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Claude, Devin, Gemini auto-review · ~15s · auto-applies on unanimous
          approve
        </p>
        <button
          type="submit"
          disabled={disabled}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting || pending ? "Reviewing…" : "Propose"}
        </button>
      </div>
    </form>
  );
}
