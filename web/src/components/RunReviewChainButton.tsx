"use client";

/**
 * "Run review chain" — drives a Living Article through Claude → Devin →
 * Claude → Gemini → Devin in one click. The route enforces the operator
 * gate (Dr. Cheteni only) so non-approvers see a 403.
 *
 * The pipeline call can take 30-90s. We surface live progress as each
 * phase completes by streaming the response object back from the API
 * after it finishes (sequential phases, not interleaved streaming —
 * a future PR can chunk this).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PhaseResult {
  phase: string;
  reviewer_id: string;
  summary: string;
  body: string;
  ran: boolean;
  error?: string;
}

interface RunResult {
  startingPhase: string;
  endingPhase: string;
  results: PhaseResult[];
}

export function RunReviewChainButton({ articleId }: { articleId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/articles/${articleId}/run-pipeline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const data = (await res.json().catch(() => ({}))) as
        | RunResult
        | { error?: string };
      if (!res.ok) {
        const message =
          "error" in data && typeof data.error === "string"
            ? data.error
            : `Pipeline failed (HTTP ${res.status}).`;
        setErr(message);
        return;
      }
      setResult(data as RunResult);
      router.refresh();
    } catch (e) {
      setErr(
        "Couldn't reach the pipeline. " +
          (e instanceof Error ? e.message : ""),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy
          ? "Running pipeline (this can take ~60s)…"
          : "Run review chain"}
      </button>
      {err && <p className="text-sm text-rose-300">{err}</p>}
      {result && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-300">
          <p>
            Walked from <code>{result.startingPhase}</code> →{" "}
            <code>{result.endingPhase}</code>.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {result.results.map((r) => (
              <li key={r.phase}>
                {r.ran ? "✓" : "✗"} {r.phase} — {r.reviewer_id}
                {r.error ? ` (error: ${r.error})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
