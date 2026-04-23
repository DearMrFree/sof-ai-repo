"use client";

import { useState } from "react";
import { Bot, CheckCircle2, ExternalLink, GitPullRequest, Rocket, Sparkles } from "lucide-react";

interface Capstone {
  title: string;
  prompt: string;
  repoHint?: string;
  rubric?: string[];
}

type SessionState =
  | { phase: "idle" }
  | { phase: "launching" }
  | {
      phase: "running";
      sessionUrl: string;
      startedAt: string;
    }
  | {
      phase: "complete";
      sessionUrl: string;
      prUrl: string;
    };

export function DevinCapstone({
  programSlug,
  lessonSlug,
  capstone,
}: {
  programSlug: string;
  lessonSlug: string;
  capstone: Capstone;
}) {
  const [state, setState] = useState<SessionState>({ phase: "idle" });
  const [prompt, setPrompt] = useState(capstone.prompt);

  async function launch() {
    setState({ phase: "launching" });
    // Call backend which either spawns a real Devin session (if DEVIN_API_KEY and
    // DEVIN_TASKS_ENABLED=true) or returns a demo/stubbed session URL.
    try {
      const res = await fetch("/api/devin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug,
          lessonSlug,
          prompt,
          repoHint: capstone.repoHint,
          title: capstone.title,
        }),
      });
      if (!res.ok) {
        throw new Error(`Launch failed (${res.status})`);
      }
      const data = (await res.json()) as {
        sessionUrl: string;
        prUrl?: string;
        stub?: boolean;
      };
      if (!data.sessionUrl) {
        throw new Error("Launch response missing sessionUrl");
      }
      if (data.prUrl) {
        setState({
          phase: "complete",
          sessionUrl: data.sessionUrl,
          prUrl: data.prUrl,
        });
      } else {
        setState({
          phase: "running",
          sessionUrl: data.sessionUrl,
          startedAt: new Date().toISOString(),
        });
      }
    } catch {
      setState({ phase: "idle" });
    }
  }

  return (
    <section className="mt-10 overflow-hidden rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5">
      <div className="border-b border-indigo-500/20 bg-indigo-500/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500">
            <Rocket className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-indigo-300">
              Devin capstone
            </p>
            <p className="text-sm font-semibold text-white">{capstone.title}</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <p className="text-sm text-zinc-300">
          This is where the rubber meets the road. Describe what you want built
          below, and Devin — a real autonomous engineer — will open a PR against
          a scratch repo. Your job is to review it and iterate.
        </p>

        <label className="mt-4 block text-xs font-medium text-zinc-400">
          Your task for Devin
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          disabled={state.phase !== "idle"}
          className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 disabled:opacity-60"
        />

        {capstone.repoHint && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500">
            <GitPullRequest className="h-3 w-3" />
            Scratch repo: <code className="text-zinc-400">{capstone.repoHint}</code>
          </p>
        )}

        {capstone.rubric && capstone.rubric.length > 0 && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <p className="text-xs font-medium text-zinc-300">Rubric</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              {capstone.rubric.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-400" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5">
          {state.phase === "idle" && (
            <button
              onClick={launch}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400"
            >
              <Sparkles className="h-4 w-4" />
              Launch Devin session
            </button>
          )}
          {state.phase === "launching" && (
            <div className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300">
              <Bot className="h-4 w-4 animate-pulse" />
              Launching Devin…
            </div>
          )}
          {state.phase === "running" && (
            <div className="flex flex-col gap-3 rounded-lg border border-indigo-500/30 bg-zinc-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  Devin is working on it…
                </p>
                <p className="text-xs text-zinc-400">
                  Started {new Date(state.startedAt).toLocaleTimeString()}. Open
                  the session to watch live.
                </p>
              </div>
              <a
                href={state.sessionUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
              >
                <ExternalLink className="h-4 w-4" />
                Open session
              </a>
            </div>
          )}
          {state.phase === "complete" && (
            <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-medium text-white">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Devin opened a PR
                </p>
                <p className="text-xs text-zinc-400">
                  Review the diff, leave comments, and merge when satisfied.
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={state.sessionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200"
                >
                  <Bot className="h-3.5 w-3.5" />
                  Session
                </a>
                <a
                  href={state.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white"
                >
                  <GitPullRequest className="h-3.5 w-3.5" />
                  View PR
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
