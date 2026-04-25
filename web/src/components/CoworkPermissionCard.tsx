"use client";

import { useState } from "react";
import { Check, Loader2, Wand2, X } from "lucide-react";
import type { CoworkExecutionResult, CoworkToolCall } from "@/lib/cowork/types";

interface Props {
  call: CoworkToolCall;
  onResult: (result: CoworkExecutionResult) => void;
  onDeny: () => void;
}

type State = "pending" | "running" | "done" | "denied";

export function CoworkPermissionCard({ call, onResult, onDeny }: Props) {
  const [state, setState] = useState<State>("pending");
  const [result, setResult] = useState<CoworkExecutionResult | null>(null);

  async function grant() {
    setState("running");
    try {
      const res = await fetch("/api/cowork/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: call.callId }),
      });
      const data = (await res.json()) as CoworkExecutionResult | { error: string };
      if ("error" in data && !("toolId" in data)) {
        const failed: CoworkExecutionResult = {
          ok: false,
          toolId: call.toolId,
          error: data.error,
          durationMs: 0,
        };
        setResult(failed);
        setState("done");
        onResult(failed);
        return;
      }
      const r = data as CoworkExecutionResult;
      setResult(r);
      setState("done");
      onResult(r);
    } catch (err) {
      const failed: CoworkExecutionResult = {
        ok: false,
        toolId: call.toolId,
        error: err instanceof Error ? err.message : "Network error",
        durationMs: 0,
      };
      setResult(failed);
      setState("done");
      onResult(failed);
    }
  }

  function deny() {
    setState("denied");
    onDeny();
  }

  const tone = call.mutating ? "amber" : "sky";
  const ring =
    tone === "amber"
      ? "border-amber-400/40 bg-amber-500/5"
      : "border-sky-400/40 bg-sky-500/5";
  const chipBg = tone === "amber" ? "bg-amber-500/20" : "bg-sky-500/20";
  const chipFg = tone === "amber" ? "text-amber-300" : "text-sky-300";
  const grantBg =
    tone === "amber"
      ? "bg-amber-500 text-zinc-900 hover:bg-amber-400"
      : "bg-sky-500 text-zinc-900 hover:bg-sky-400";

  return (
    <div className={`rounded-2xl border p-4 ${ring}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${chipBg}`}>
          <Wand2 className={`h-4 w-4 ${chipFg}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${chipFg}`}>
            {call.mutating ? "Approval required" : "Read-only action"}
          </p>
          <p className="mt-1 text-sm font-medium text-white">{call.preview}</p>
          <p className="mt-1 font-mono text-[11px] text-zinc-500">{call.toolId}</p>
          {Object.keys(call.params).length > 0 && (
            <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-900/60 p-2 text-[11px] text-zinc-300">
              {JSON.stringify(call.params, null, 2)}
            </pre>
          )}

          {state === "pending" && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={grant}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${grantBg}`}
              >
                <Check className="h-3.5 w-3.5" /> Grant
              </button>
              <button
                type="button"
                onClick={deny}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                <X className="h-3.5 w-3.5" /> Deny
              </button>
            </div>
          )}
          {state === "running" && (
            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…
            </div>
          )}
          {state === "done" && result && (
            <pre
              className={`mt-3 overflow-x-auto rounded-md p-2 text-[11px] ${
                result.ok
                  ? "bg-emerald-500/10 text-emerald-200"
                  : "bg-rose-500/10 text-rose-200"
              }`}
            >
              {result.ok
                ? JSON.stringify(result.result, null, 2)
                : `Error: ${result.error}`}
            </pre>
          )}
          {state === "denied" && (
            <p className="mt-3 text-xs text-zinc-500">Denied. Nothing was run.</p>
          )}
        </div>
      </div>
    </div>
  );
}
