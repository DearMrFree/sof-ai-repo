"use client";

/**
 * Approve button on /articles/{id}.
 *
 * The button is rendered for every visitor while an article is in
 * `awaiting_approval`, but the click POSTs to /api/articles/{id}/approve
 * which itself enforces that the signed-in user's email matches Dr.
 * Cheteni's. A non-Cheteni click receives a 403 and the UI surfaces the
 * error inline. Showing the button universally (even to non-approvers)
 * is intentional — it advertises the gate as a transparent part of the
 * pipeline rather than a hidden privilege.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  articleId: number;
}

export function ApproveArticleButton({ articleId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? `Approval failed (HTTP ${res.status}).`);
        return;
      }
      // Refresh the server component so the timeline + state reflects
      // the published phase without a manual reload.
      router.refresh();
    } catch (e) {
      setErr(
        "Couldn't reach the articles API. " +
          (e instanceof Error ? e.message : ""),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={approve}
        disabled={busy}
        className="rounded-lg bg-orange-500/90 px-4 py-2 text-sm font-semibold text-orange-50 transition hover:bg-orange-400 disabled:opacity-50"
      >
        {busy ? "Approving…" : "Approve & publish"}
      </button>
      {err && (
        <p className="mt-2 text-sm text-rose-300">
          {err}
        </p>
      )}
    </div>
  );
}
