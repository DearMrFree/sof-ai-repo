"use client";

/**
 * Inline comment composer for /applications/{id}. Authenticated users
 * write a comment; on success the page refreshes its server data so the
 * new comment lands in the thread without us having to manage local
 * state for the list itself.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Loader2 } from "lucide-react";

interface Props {
  applicationId: number;
  signedIn: boolean;
}

export function ApplicationCommentForm({ applicationId, signedIn }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <p className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
        <Link href="/signin" className="text-fuchsia-300 underline">
          Sign in
        </Link>{" "}
        to leave a comment on this application.
      </p>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/applications/${applicationId}/comments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: text }),
          },
        );
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(
            (detail as { error?: string }).error ??
              `Server returned ${res.status}`,
          );
        }
        setBody("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not post.");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
    >
      <label
        htmlFor={`comment-${applicationId}`}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-400"
      >
        <MessageCircle className="h-3.5 w-3.5" /> Add a comment
      </label>
      <textarea
        id={`comment-${applicationId}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Why does this application stand out — or not?"
        rows={3}
        maxLength={4000}
        className="mt-2 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-fuchsia-500/60 focus:outline-none"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        {error ? (
          <p className="text-xs text-rose-400">{error}</p>
        ) : (
          <p className="text-xs text-zinc-500">
            Comments feed into the trio&apos;s decision.
          </p>
        )}
        <button
          type="submit"
          disabled={pending || body.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-fuchsia-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-fuchsia-400 disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Posting…
            </>
          ) : (
            "Post comment"
          )}
        </button>
      </div>
    </form>
  );
}
