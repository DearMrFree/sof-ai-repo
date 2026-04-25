"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ThumbsDown, ThumbsUp, HelpCircle } from "lucide-react";

const VOTES: Array<{
  value: "yes" | "no" | "maybe";
  label: string;
  icon: React.ReactNode;
  tone: string;
}> = [
  {
    value: "yes",
    label: "Recommend conditional acceptance",
    icon: <ThumbsUp className="h-4 w-4" />,
    tone:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-500",
  },
  {
    value: "maybe",
    label: "Maybe — needs discussion",
    icon: <HelpCircle className="h-4 w-4" />,
    tone:
      "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:border-amber-500",
  },
  {
    value: "no",
    label: "Decline",
    icon: <ThumbsDown className="h-4 w-4" />,
    tone:
      "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-500",
  },
];

export function ReviewForm({
  applicationId,
  token,
  existingVote,
  existingComment,
  reviewerName,
}: {
  applicationId: number;
  token: string;
  existingVote?: "yes" | "no" | "maybe";
  existingComment?: string;
  reviewerName: string;
}) {
  const router = useRouter();
  const [vote, setVote] = useState<"yes" | "no" | "maybe" | null>(
    existingVote ?? null,
  );
  const [comment, setComment] = useState(existingComment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vote) {
      setError("Pick one option (yes / maybe / no).");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, vote, comment }),
      });
      const data = (await res.json()) as
        | { status?: string }
        | { detail?: string; error?: string };
      if (!res.ok) {
        const detail =
          (data as { detail?: string; error?: string }).detail ??
          (data as { error?: string }).error ??
          "Submission failed.";
        setError(typeof detail === "string" ? detail : "Submission failed.");
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950/60 p-6"
    >
      <h2 className="text-lg font-semibold text-white">
        Your call, {reviewerName.split(" ")[0]}.
      </h2>
      <p className="mt-1 text-sm text-zinc-400">
        Devin synthesizes the trio&apos;s votes once all three are in.
        {existingVote ? " You can change your mind until then." : ""}
      </p>

      <div className="mt-4 grid gap-2">
        {VOTES.map((v) => {
          const active = vote === v.value;
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => setVote(v.value)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm transition ${
                v.tone
              } ${active ? "ring-2 ring-offset-2 ring-offset-zinc-950" : ""}`}
              aria-pressed={active}
            >
              {v.icon}
              <span className="font-medium">{v.label}</span>
            </button>
          );
        })}
      </div>

      <label className="mt-6 block">
        <span className="text-sm font-medium text-white">
          Comment (optional, but encouraged)
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={4000}
          rows={5}
          placeholder="What do you want Devin to weigh in their synthesis? Any concerns? Any conditions for acceptance?"
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
        />
      </label>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Vote recorded. {existingVote ? "Updated. " : ""}
          Devin will synthesize once the trio is complete.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting || !vote}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:bg-zinc-700"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting your vote
          </>
        ) : (
          <>
            {existingVote ? "Update vote" : "Submit vote"}
          </>
        )}
      </button>
    </form>
  );
}
