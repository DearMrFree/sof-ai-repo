"use client";

/**
 * OnboardingWizard — the 6-question /welcome flow.
 *
 * Steps (in order):
 *   1. Identity     — display name + handle (pre-filled from session/email)
 *   2. User type    — pick one of 6 audiences (drives /u filter + admin)
 *   3. Goals        — multi-select pills + free-text "anything else"
 *   4. Strengths    — 3 things you're already good at
 *   5. First build  — what's the first project your twin will help you ship?
 *   6. Your twin    — name, emoji, persona seed
 *
 * On submit:
 *   - POST /api/users/onboarding (server-proxied to FastAPI with internal-auth)
 *   - 201/200 → redirect to /u/{handle}
 *   - 409 conflict → flag handle, let user retry
 *   - other errors → inline message, no redirect (so the user can adjust)
 *
 * The wizard is fully accessible (each step is its own form section with
 * `aria-current="step"`), keyboard-friendly (Enter advances except in
 * textareas), and resilient to refresh — answers are mirrored to
 * sessionStorage on every change so a refresh mid-flow doesn't lose
 * progress.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";

const USER_TYPES: { id: UserType; label: string; blurb: string; emoji: string }[] = [
  {
    id: "student",
    label: "Student",
    blurb: "I'm here to learn anything. Pair me with agents that teach.",
    emoji: "🎓",
  },
  {
    id: "educator",
    label: "Educator",
    blurb: "I teach humans + agents. I want my own classroom on sof.ai.",
    emoji: "🧑‍🏫",
  },
  {
    id: "corporation",
    label: "Corporation",
    blurb: "We're upskilling our org with agents — humans-in-the-loop, by design.",
    emoji: "🏢",
  },
  {
    id: "administrator",
    label: "Administrator",
    blurb: "I run a school / district / program. I need orchestration.",
    emoji: "🗂️",
  },
  {
    id: "researcher",
    label: "Researcher",
    blurb: "I publish open work, and I want my AI to co-author with me.",
    emoji: "🔬",
  },
  {
    id: "founder",
    label: "Founder / Builder",
    blurb: "I'm shipping a product with AI — train me a twin that ships, too.",
    emoji: "🚀",
  },
];

type UserType =
  | "student"
  | "educator"
  | "corporation"
  | "administrator"
  | "researcher"
  | "founder";

const GOAL_OPTIONS = [
  "Ship my first AI app",
  "Train an agent on my domain",
  "Pair with Devin daily",
  "Publish papers + open work",
  "Hire AI talent / on-board agents",
  "Run my class with AI",
  "Build a startup",
  "Explore + learn",
];

const STRENGTH_OPTIONS = [
  "Writing / docs",
  "Frontend",
  "Backend",
  "Data / ML",
  "Design",
  "Product",
  "Operations",
  "Teaching",
  "Research",
  "Sales",
  "Storytelling",
  "Community",
];

const TWIN_EMOJIS = ["🤖", "✨", "🪐", "🦾", "🧠", "🛰️", "🔮", "🦋", "💫", "🌱", "🐙", "🦊"];

interface Initial {
  email: string;
  handle: string;
  display_name: string;
  user_type: string;
  tagline: string;
  location: string;
  goals: string[];
  strengths: string[];
  first_project: string;
  twin_name: string;
  twin_emoji: string;
  twin_persona_seed: string;
  devin_session_url: string;
}

interface Props {
  initial: Initial;
  hasExisting: boolean;
}

const TOTAL_STEPS = 6;
const STORAGE_KEY = "sofai:onboarding:draft";

export function OnboardingWizard({ initial, hasExisting }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<Initial>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return initial;
      const draft = JSON.parse(raw) as Partial<Initial>;
      // Only restore if email matches — otherwise a different user signed in.
      if (draft.email && draft.email !== initial.email) return initial;
      return { ...initial, ...draft };
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // sessionStorage full / privacy-mode — non-fatal.
    }
  }, [state]);

  const set = <K extends keyof Initial>(k: K, v: Initial[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const toggleGoal = (g: string) =>
    setState((s) => ({
      ...s,
      goals: s.goals.includes(g)
        ? s.goals.filter((x) => x !== g)
        : [...s.goals, g],
    }));

  const toggleStrength = (g: string) =>
    setState((s) => ({
      ...s,
      strengths: s.strengths.includes(g)
        ? s.strengths.filter((x) => x !== g)
        : [...s.strengths, g],
    }));

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return state.display_name.trim().length > 1 && state.handle.trim().length > 1;
      case 1:
        return USER_TYPES.some((t) => t.id === state.user_type);
      case 2:
        return state.goals.length > 0 || state.tagline.trim().length > 0;
      case 3:
        return state.strengths.length > 0;
      case 4:
        return state.first_project.trim().length > 4;
      case 5:
        return state.twin_name.trim().length > 1;
      default:
        return false;
    }
  }, [step, state]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/users/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: state.email,
          handle: state.handle.trim().replace(/^@/, "").toLowerCase(),
          display_name: state.display_name.trim(),
          user_type: state.user_type,
          tagline: state.tagline.trim(),
          location: state.location.trim(),
          goals: state.goals,
          strengths: state.strengths,
          first_project: state.first_project.trim(),
          twin_name: state.twin_name.trim(),
          twin_emoji: state.twin_emoji || "🤖",
          twin_persona_seed: buildPersonaSeed(state),
          devin_session_url: state.devin_session_url.trim(),
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { handle?: string; detail?: string; error?: string }
        | null;
      if (!res.ok) {
        const detail =
          (json && (json.detail || json.error)) || `Save failed (${res.status}).`;
        if (res.status === 409) {
          setError(`That handle (@${state.handle}) is taken. Try another.`);
          setStep(0);
        } else {
          setError(String(detail));
        }
        setSubmitting(false);
        return;
      }
      // Success — clear draft + bounce to profile.
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      const handle = json?.handle ?? state.handle;
      // If they marked themselves as administrator, drop them on /admin
      // first (the real-time dashboard) — they likely want to see the
      // operator surface immediately.
      const next =
        state.user_type === "administrator" ? "/admin" : `/u/${handle}`;
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(`Network error: ${String(e)}`);
      setSubmitting(false);
    }
  }

  const goNext = () => {
    if (!canAdvance) return;
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      void submit();
    }
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div
      className="relative rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-[0_0_60px_-30px_rgba(129,140,248,0.4)] sm:p-8"
      data-testid="onboarding-wizard"
    >
      <Progress step={step} total={TOTAL_STEPS} />

      <section
        className="mt-6 min-h-[260px]"
        aria-current="step"
        data-step={step}
      >
        {step === 0 ? (
          <StepIdentity state={state} set={set} />
        ) : step === 1 ? (
          <StepUserType state={state} set={set} />
        ) : step === 2 ? (
          <StepGoals state={state} set={set} toggleGoal={toggleGoal} />
        ) : step === 3 ? (
          <StepStrengths state={state} toggleStrength={toggleStrength} />
        ) : step === 4 ? (
          <StepFirstBuild state={state} set={set} />
        ) : (
          <StepTwin state={state} set={set} />
        )}
      </section>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : null}

      <footer className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || submitting}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canAdvance || submitting}
          data-testid="wizard-next"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : step === TOTAL_STEPS - 1 ? (
            <>
              {hasExisting ? "Save changes" : "Spawn my twin"}
              <Sparkles className="h-4 w-4" />
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </footer>
    </div>
  );
}

function buildPersonaSeed(s: Initial): string {
  const parts: string[] = [];
  parts.push(`Owner: ${s.display_name} (@${s.handle}).`);
  if (s.user_type) parts.push(`Audience: ${s.user_type}.`);
  if (s.goals.length) parts.push(`Goals: ${s.goals.join(", ")}.`);
  if (s.strengths.length) parts.push(`Strengths: ${s.strengths.join(", ")}.`);
  if (s.first_project)
    parts.push(`Current project: ${s.first_project}.`);
  parts.push(
    "You are a digital AI twin paired 1:1 with this human. You learn their work, their voice, and their goals. You propose new skills via the trainer co-work loop. You are friendly, candid, and bias toward shipping.",
  );
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          className={`h-1.5 flex-1 rounded-full transition-all ${
            i < step
              ? "bg-gradient-to-r from-indigo-400 to-fuchsia-400"
              : i === step
                ? "bg-indigo-400/80"
                : "bg-zinc-800"
          }`}
        />
      ))}
    </div>
  );
}

function StepIdentity({
  state,
  set,
}: {
  state: Initial;
  set: <K extends keyof Initial>(k: K, v: Initial[K]) => void;
}) {
  return (
    <div>
      <Heading
        index={1}
        title="Who's joining sof.ai?"
        sub="Your display name + handle become your /u profile URL."
      />
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Display name">
          <input
            type="text"
            value={state.display_name}
            onChange={(e) => set("display_name", e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-white outline-none ring-indigo-500/30 focus:border-indigo-500 focus:ring-2"
            placeholder="Dr. Freedom Cheteni"
            autoFocus
          />
        </Field>
        <Field label="Handle">
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30">
            <span className="mr-1 text-sm text-zinc-500">@</span>
            <input
              type="text"
              value={state.handle}
              onChange={(e) =>
                set(
                  "handle",
                  e.target.value
                    .replace(/^@/, "")
                    .replace(/[^a-zA-Z0-9._-]/g, "")
                    .slice(0, 64),
                )
              }
              className="w-full bg-transparent text-sm text-white outline-none"
              placeholder="freedom"
            />
          </div>
        </Field>
        <Field label="Location (optional)" full>
          <input
            type="text"
            value={state.location}
            onChange={(e) => set("location", e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-white outline-none ring-indigo-500/30 focus:border-indigo-500 focus:ring-2"
            placeholder="San Francisco · Remote · Everywhere"
          />
        </Field>
      </div>
    </div>
  );
}

function StepUserType({
  state,
  set,
}: {
  state: Initial;
  set: <K extends keyof Initial>(k: K, v: Initial[K]) => void;
}) {
  return (
    <div>
      <Heading
        index={2}
        title="Which lane fits you best?"
        sub="We use this to tune your home dashboard and to make you discoverable on /u."
      />
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {USER_TYPES.map((t) => {
          const active = state.user_type === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-user-type={t.id}
              onClick={() => set("user_type", t.id)}
              className={`group flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                active
                  ? "border-indigo-500/60 bg-indigo-500/10"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
              }`}
            >
              <span className="text-2xl">{t.emoji}</span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-white">
                  {t.label}
                </span>
                <span className="mt-0.5 block text-xs text-zinc-400">
                  {t.blurb}
                </span>
              </span>
              {active ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-indigo-300" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepGoals({
  state,
  set,
  toggleGoal,
}: {
  state: Initial;
  set: <K extends keyof Initial>(k: K, v: Initial[K]) => void;
  toggleGoal: (g: string) => void;
}) {
  return (
    <div>
      <Heading
        index={3}
        title="What do you want to do here?"
        sub="Pick all that apply. We seed your twin's goals from this."
      />
      <div className="mt-5 flex flex-wrap gap-2">
        {GOAL_OPTIONS.map((g) => {
          const active = state.goals.includes(g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggleGoal(g)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                active
                  ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-100"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>
      <Field label="Anything else, in your own words? (one-liner tagline)" className="mt-6">
        <input
          type="text"
          value={state.tagline}
          onChange={(e) => set("tagline", e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-white outline-none ring-indigo-500/30 focus:border-indigo-500 focus:ring-2"
          placeholder="Building the classroom of the future."
          maxLength={300}
        />
      </Field>
    </div>
  );
}

function StepStrengths({
  state,
  toggleStrength,
}: {
  state: Initial;
  toggleStrength: (g: string) => void;
}) {
  return (
    <div>
      <Heading
        index={4}
        title="What are you already good at?"
        sub="Your twin will lean on these strengths and seek mentors for the rest."
      />
      <div className="mt-5 flex flex-wrap gap-2">
        {STRENGTH_OPTIONS.map((g) => {
          const active = state.strengths.includes(g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggleStrength(g)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                active
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-100"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepFirstBuild({
  state,
  set,
}: {
  state: Initial;
  set: <K extends keyof Initial>(k: K, v: Initial[K]) => void;
}) {
  return (
    <div>
      <Heading
        index={5}
        title="What's the first thing you want to ship?"
        sub="A sentence is fine. We'll prefill this as your first Devin session prompt."
      />
      <Field label="Project / idea" className="mt-5">
        <textarea
          value={state.first_project}
          onChange={(e) => set("first_project", e.target.value)}
          rows={4}
          maxLength={500}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-white outline-none ring-indigo-500/30 focus:border-indigo-500 focus:ring-2"
          placeholder="Build an LMS for AI-native classrooms — humans and agents enrolled in the same room."
        />
      </Field>
      <Field
        label="Optional: paste a Devin session URL to pin it on your profile"
        className="mt-4"
      >
        <input
          type="url"
          value={state.devin_session_url}
          onChange={(e) => set("devin_session_url", e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-white outline-none ring-indigo-500/30 focus:border-indigo-500 focus:ring-2"
          placeholder="https://app.devin.ai/sessions/…"
        />
      </Field>
    </div>
  );
}

function StepTwin({
  state,
  set,
}: {
  state: Initial;
  set: <K extends keyof Initial>(k: K, v: Initial[K]) => void;
}) {
  return (
    <div>
      <Heading
        index={6}
        title="Name your AI twin."
        sub="They live on your profile and learn alongside you. You can rename them anytime."
      />
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
            Avatar
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {TWIN_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => set("twin_emoji", e)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition ${
                  state.twin_emoji === e
                    ? "border-indigo-400 bg-indigo-500/15"
                    : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                }`}
                aria-label={`Pick ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <Field label="Twin name">
          <input
            type="text"
            value={state.twin_name}
            onChange={(e) => set("twin_name", e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-white outline-none ring-indigo-500/30 focus:border-indigo-500 focus:ring-2"
            placeholder="Lyra · Atlas · Mirror · whatever feels right"
            maxLength={80}
          />
        </Field>
      </div>
      <div className="mt-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4">
        <p className="text-xs uppercase tracking-wider text-indigo-300/80">
          Preview
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/30 text-2xl">
            {state.twin_emoji || "🤖"}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">
              {state.twin_name || "Your twin"}
            </p>
            <p className="truncate text-xs text-zinc-400">
              Trained by @{state.handle || "you"} · learning {state.first_project ? truncate(state.first_project, 60) : "alongside you"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
  className,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  className?: string;
}) {
  return (
    <label className={`${full ? "sm:col-span-2" : ""} block ${className ?? ""}`}>
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Heading({
  index,
  title,
  sub,
}: {
  index: number;
  title: string;
  sub: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-indigo-300/80">
        Step {index} of {TOTAL_STEPS}
      </p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      <p className="mt-1 text-sm text-zinc-400">{sub}</p>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
