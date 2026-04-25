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

  const partialFailure =
    !!result && result.results.some((r) => !r.ran || r.error);
  const allPassed =
    !!result && result.results.length > 0 && !partialFailure;
  // The button label reflects whether retrying is meaningful: if any
  // prior attempt left work behind (partial-result rows OR a top-level
  // error), the chain is in a resumable state and the button promises
  // to pick up where it left off (the backend pipeline is idempotent).
  const showResumeLabel = partialFailure || !!err;

  return (
    <div className="space-y-3">
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy
          ? "Running pipeline (Claude → Devin → Claude → Gemini → Devin, ~2-3 min)…"
          : showResumeLabel
            ? "Resume review chain"
            : "Run review chain"}
      </button>
      {busy && (
        <p className="text-xs text-zinc-500">
          Don&apos;t close this tab — each phase makes a real model call.
          The article state is durable on the backend; if the request
          drops, refresh the page and click the button again to resume.
        </p>
      )}
      {err && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">
          <p className="font-semibold">Pipeline error</p>
          <p className="mt-1 text-xs text-rose-300">{err}</p>
          <p className="mt-2 text-xs text-zinc-500">
            The article wasn&apos;t lost. Click <em>Resume review chain</em>{" "}
            above to retry from the last completed phase.
          </p>
        </div>
      )}
      {result && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            allPassed
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-100"
              : "border-amber-500/30 bg-amber-500/5 text-amber-100"
          }`}
        >
          <p>
            Walked from <code>{result.startingPhase}</code> →{" "}
            <code>{result.endingPhase}</code>
            {allPassed ? " · all 5 rounds completed." : " · partial run."}
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {result.results.map((r) => (
              <li key={r.phase} className="font-mono">
                <span
                  className={
                    r.ran
                      ? "text-emerald-300"
                      : "text-rose-300"
                  }
                >
                  {r.ran ? "✓" : "✗"}
                </span>{" "}
                {r.phase} — {r.reviewer_id}
                {r.error ? (
                  <span className="text-rose-300">
                    {" "}
                    · {r.error.slice(0, 120)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
