"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";

interface Props {
  token: string;
  email: string;
  name: string | null;
  programSlug: string | null;
}

/**
 * Accept-and-join client button.
 *
 * Flow:
 *   1. If the user isn't signed in, kick them through the "email" credentials
 *      provider with their invite email pre-filled. (Guest accounts wouldn't
 *      persist their identity across sessions, so we prefer the email path
 *      for invited humans.)
 *   2. Once a session exists, POST to our proxy at
 *      /api/invitations/accept/<token> which forwards to the FastAPI layer.
 *      That marks the invite as accepted and records accepted_user_id so the
 *      inviter can audit it.
 *   3. Redirect the user to /classroom (or the invited program if one was
 *      attached).
 */
export function AcceptInviteButton({
  token,
  email,
  name,
  programSlug,
}: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destination = programSlug ? `/learn/${programSlug}` : "/classroom";

  async function acceptAndRedirect() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/accept/${token}`, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      router.push(destination);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't accept the invite just now.",
      );
      setSubmitting(false);
    }
  }

  async function handleClick() {
    if (status === "loading") return;
    if (!session?.user) {
      // Pre-fill their invited email via the "email" credentials provider.
      // If NextAuth returns cleanly they'll land back here (via callbackUrl)
      // and the next click will hit the accept path.
      await signIn("email", {
        email,
        callbackUrl:
          typeof window !== "undefined" ? window.location.href : "/",
      });
      return;
    }
    await acceptAndRedirect();
  }

  const primaryLabel = session?.user
    ? `Accept & Join as ${name ?? session.user.name ?? "you"}`
    : "Sign in with this email & join";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting || status === "loading"}
        className="sof-lift inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Accepting…" : primaryLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
      {error && (
        <p className="text-[12px] text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
