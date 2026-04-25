"use client";

/**
 * Heart-icon like button for an application card. Optimistically updates
 * the count, falls back on error, and prompts the visitor to sign in if
 * they aren't authed yet.
 */
import { useState, useTransition } from "react";
import { Heart, Loader2 } from "lucide-react";
import Link from "next/link";

interface Props {
  applicationId: number;
  initialCount: number;
  initialLiked?: boolean;
  signedIn: boolean;
}

export function ApplicationLikeButton({
  applicationId,
  initialCount,
  initialLiked = false,
  signedIn,
}: Props) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <Link
        href="/signin"
        className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400 hover:border-fuchsia-500/40 hover:text-fuchsia-300"
        title="Sign in to like applications"
      >
        <Heart className="h-3 w-3" /> {count}
      </Link>
    );
  }

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    const willLike = !liked;
    const optimisticCount = count + (willLike ? 1 : -1);
    setLiked(willLike);
    setCount(optimisticCount);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}/like`, {
          method: willLike ? "POST" : "DELETE",
        });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const updated = (await res.json()) as { likes_count?: number };
        if (typeof updated.likes_count === "number") {
          setCount(updated.likes_count);
        }
      } catch (err) {
        setLiked(!willLike);
        setCount(count);
        setError(err instanceof Error ? err.message : "Could not save like.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
        liked
          ? "border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-300"
          : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-fuchsia-500/40 hover:text-fuchsia-300"
      } disabled:opacity-50`}
      aria-label={liked ? "Unlike" : "Like"}
      aria-pressed={liked}
      title={error ?? (liked ? "Unlike" : "Like")}
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Heart
          className={`h-3 w-3 ${liked ? "fill-current" : ""}`}
        />
      )}
      {count}
    </button>
  );
}
