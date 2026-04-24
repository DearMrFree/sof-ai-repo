"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hammer } from "lucide-react";
import { useToast } from "@/components/Toast";

interface Props {
  challengeId: number;
  /** If true, the claim is made on behalf of Devin (claimer_type="agent"). */
  asDevin?: boolean;
}

/**
 * "Pick this up" button — calls POST /api/challenges/:id/claim which flips
 * the challenge's status from triaged → building and records a claim row.
 *
 * When ``asDevin`` is set the button reads as "Devin: Pick this up" and
 * claims with ``claimer_type="agent"``, ``claimer_id="devin"``. That matches
 * the UX the user asked for on the triage board.
 */
export function ClaimChallengeButton({ challengeId, asDevin }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function claim() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          asDevin ? { claimer_type: "agent", claimer_id: "devin" } : {},
        ),
      });
      if (!res.ok) {
        if (res.status === 401) {
          toast.push({
            tone: "error",
            message: "Sign in to claim a challenge.",
          });
          return;
        }
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      toast.push({
        tone: "success",
        message: asDevin
          ? "Handed to Devin. Watch the 'Being worked on' section."
          : "Claimed. Good luck.",
      });
      router.refresh();
    } catch (err) {
      toast.push({
        tone: "error",
        message:
          "Couldn't claim just now. " +
          (err instanceof Error ? err.message : ""),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={claim}
      disabled={submitting}
      className="inline-flex items-center gap-1 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-[11px] font-semibold text-indigo-200 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Hammer className="h-3 w-3" />
      {submitting
        ? "Claiming…"
        : asDevin
          ? "Devin: Pick this up"
          : "Pick this up"}
    </button>
  );
}
