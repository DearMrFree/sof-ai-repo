"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  slug: string;
  noteId: number;
}

export function RetractMentorNoteButton({ slug, noteId }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleClick() {
    if (
      !confirm(
        "Retract this applied note? It will stop flowing into the live system prompt within 5 minutes.",
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/embed/${slug}/mentor-notes/${noteId}/retract`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail || `Retract failed (${res.status})`);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="text-xs text-rose-700 hover:text-rose-900 underline-offset-4 hover:underline disabled:opacity-50"
      >
        {submitting ? "Retracting…" : "Retract"}
      </button>
      {error && <div className="text-xs text-rose-700 mt-1">{error}</div>}
    </div>
  );
}
