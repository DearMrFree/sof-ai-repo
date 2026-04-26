"use client";

import { useState } from "react";
import { Sparkles, ShieldCheck, Loader2, RefreshCcw } from "lucide-react";

import type { TwinSkill, TwinSummary } from "@/lib/twin/api";

interface Props {
  summary: TwinSummary;
  isOwner: boolean;
  initialSkills: TwinSkill[];
}

const STATUS_LABELS: Record<TwinSkill["status"], string> = {
  pending: "Pending",
  reviewing: "Reviewing…",
  applied: "Applied",
  rejected: "Rejected",
  retracted: "Retracted",
};

const STATUS_RING: Record<TwinSkill["status"], string> = {
  pending: "border-zinc-700 bg-zinc-900/60 text-zinc-300",
  reviewing: "border-amber-500/50 bg-amber-500/10 text-amber-300",
  applied: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  rejected: "border-rose-500/50 bg-rose-500/10 text-rose-300",
  retracted: "border-zinc-700 bg-zinc-900/60 text-zinc-500",
};

export default function TwinSection({
  summary,
  isOwner,
  initialSkills,
}: Props) {
  const [skills, setSkills] = useState<TwinSkill[]>(initialSkills);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);

  const appliedCount = skills.filter((s) => s.status === "applied").length;

  async function reload() {
    try {
      const res = await fetch(`/api/twins/${summary.handle}/skills`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items: TwinSkill[] };
      setSkills(data.items ?? []);
    } catch {
      // keep existing skills on transient error
    }
  }

  async function onPropose(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    setLastOutcome(null);
    try {
      const res = await fetch(`/api/twins/${summary.handle}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), proposed_text: text.trim() }),
      });
      const data = (await res.json()) as {
        skill?: TwinSkill;
        finalized_status?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Train failed (HTTP ${res.status})`);
        return;
      }
      setLastOutcome(data.finalized_status ?? "incomplete");
      await reload();
      if (data.finalized_status === "applied" || data.finalized_status === "rejected") {
        setTitle("");
        setText("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onRetract(skillId: number) {
    if (!confirm("Retract this skill from your twin?")) return;
    try {
      const res = await fetch(
        `/api/twins/${summary.handle}/skills/${skillId}/retract`,
        { method: "POST" },
      );
      if (!res.ok) {
        const t = await res.text();
        setError(`Retract failed: ${t.slice(0, 200)}`);
        return;
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section
      data-testid="twin-section"
      className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5"
    >
      <header className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/30 text-2xl"
          aria-hidden
        >
          {summary.twin_emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-white">
              {summary.twin_name}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-indigo-300">
              <Sparkles className="h-3 w-3" />
              AI twin
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
              data-testid="twin-applied-count"
            >
              <ShieldCheck className="h-3 w-3" />
              {appliedCount} skill{appliedCount === 1 ? "" : "s"} applied
            </span>
          </div>
          {summary.twin_persona_seed && (
            <p className="mt-2 text-sm text-zinc-300">
              {summary.twin_persona_seed}
            </p>
          )}
          {summary.first_project && (
            <p className="mt-1 text-xs text-zinc-500">
              First project: {summary.first_project}
            </p>
          )}
        </div>
      </header>

      {isOwner && (
        <form
          onSubmit={onPropose}
          className="mt-5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4"
          data-testid="twin-train-form"
        >
          <h3 className="text-sm font-semibold text-indigo-200">
            Train a new skill
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            What should your twin learn next? It runs through Claude → Devin →
            Gemini review (~15s) before folding into your twin&apos;s persona.
          </p>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short title (optional)"
            maxLength={120}
            className="mt-3 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
            disabled={submitting}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='e.g. "When asked about my work, prioritize my Build AI LMS project and offer to introduce the visitor."'
            rows={3}
            maxLength={2000}
            className="mt-2 w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
            disabled={submitting}
            data-testid="twin-skill-textarea"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-500">
              {text.length}/2000 chars
            </div>
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="twin-skill-submit"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reviewing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Train your twin
                </>
              )}
            </button>
          </div>
          {error && (
            <p
              className="mt-2 text-xs text-rose-400"
              data-testid="twin-error"
            >
              {error}
            </p>
          )}
          {lastOutcome && !error && (
            <p
              className="mt-2 text-xs text-emerald-400"
              data-testid="twin-outcome"
            >
              {lastOutcome === "applied"
                ? "Approved by all reviewers — applied to your twin."
                : lastOutcome === "rejected"
                  ? "Rejected by review chain. See the row below for reasoning."
                  : `Review chain: ${lastOutcome}`}
            </p>
          )}
        </form>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">
            Trained skills
          </h3>
          <button
            onClick={reload}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            type="button"
            aria-label="Refresh skills"
          >
            <RefreshCcw className="h-3 w-3" />
            Refresh
          </button>
        </div>
        {skills.length === 0 ? (
          <p
            className="text-xs text-zinc-500"
            data-testid="twin-empty-state"
          >
            {isOwner
              ? "No skills yet. Train your first one above."
              : "This twin hasn't been trained on any skills yet."}
          </p>
        ) : (
          <ul
            className="flex flex-col gap-2"
            data-testid="twin-skill-list"
          >
            {skills.map((skill) => (
              <li
                key={skill.id}
                data-testid="twin-skill-row"
                data-skill-status={skill.status}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_RING[skill.status]}`}
                  >
                    {STATUS_LABELS[skill.status]}
                  </span>
                  {skill.title && (
                    <span className="text-sm font-medium text-zinc-200">
                      {skill.title}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-zinc-500">
                    {new Date(skill.proposed_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap">
                  {skill.applied_text || skill.proposed_text}
                </p>
                {skill.rejection_reason && (
                  <p className="mt-1 text-xs text-rose-400">
                    Rejected: {skill.rejection_reason}
                  </p>
                )}
                {skill.reviewer_chain.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300">
                      Reviewer chain ({skill.reviewer_chain.length})
                    </summary>
                    <ul className="mt-1 space-y-1 text-[11px] text-zinc-400">
                      {skill.reviewer_chain.map((r) => (
                        <li key={r.reviewer_id}>
                          <span className="font-mono">{r.reviewer_id}</span>:{" "}
                          <span
                            className={
                              r.verdict === "approve"
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }
                          >
                            {r.verdict}
                          </span>{" "}
                          — {r.summary}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {isOwner && skill.status !== "rejected" && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onRetract(skill.id)}
                      className="text-[11px] text-zinc-500 hover:text-rose-400"
                    >
                      Retract
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
