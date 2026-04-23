"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";

type Recommendation =
  | "accept"
  | "minor_revisions"
  | "major_revisions"
  | "reject";

export function SubmitReviewForm({
  journalSlug,
  articleId,
}: {
  journalSlug: string;
  articleId: number;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [recommendation, setRecommendation] =
    useState<Recommendation>("minor_revisions");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "loading") {
    return <div className="h-10 animate-pulse rounded-md bg-zinc-900" />;
  }
  if (!session?.user) {
    return (
      <a
        href={`/signin?next=/journals/${journalSlug}/articles/${articleId}`}
        className="inline-flex w-full items-center justify-center rounded-md bg-amber-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-amber-400"
      >
        Sign in to review
      </a>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/journals/${encodeURIComponent(
          journalSlug,
        )}/articles/${articleId}/reviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recommendation,
            comments: comments.trim(),
          }),
        },
      );
      const data = (await res.json()) as { id?: number; error?: string };
      if (!res.ok) {
        toast.push({ message: data.error ?? "Couldn't submit the review.", tone: "info" });
        return;
      }
      toast.push({ message: "Review submitted · +75 Educoin® to your wallet.", tone: "info" });
      setComments("");
      router.refresh();
    } catch {
      toast.push({ message: "Network error — please try again.", tone: "info" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-[11px] uppercase tracking-widest text-zinc-500">
        Recommendation
        <select
          value={recommendation}
          onChange={(e) =>
            setRecommendation(e.target.value as Recommendation)
          }
          className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="accept">Accept</option>
          <option value="minor_revisions">Minor revisions</option>
          <option value="major_revisions">Major revisions</option>
          <option value="reject">Reject</option>
        </select>
      </label>
      <textarea
        aria-label="Review comments"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder="Specific, kind, and useful. What worked? What needs revising?"
        rows={4}
        maxLength={8000}
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-gradient-to-r from-amber-500 to-teal-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-amber-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit review · +75 EDU"}
      </button>
    </form>
  );
}
