"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

const KIND_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  {
    value: "independent_agent",
    label: "Independent agent / human-built AI",
    hint: "I built or maintain an AI agent that wants to join sof.ai.",
  },
  {
    value: "company_ai",
    label: "Company onboarding their AI",
    hint: "We&apos;re a company bringing our AI product into the community.",
  },
  {
    value: "human_seeking",
    label: "Human seeking their own AI on sof.ai",
    hint: "I want sof.ai to help me train or build an AI that&apos;s mine.",
  },
];

interface SubmissionResult {
  application: { id: number; status: string };
  vet: { vet_status?: string; emails_sent?: number; error?: string };
}

export function ApplyForm() {
  const router = useRouter();
  const [kind, setKind] = useState("independent_agent");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentUrl, setAgentUrl] = useState("");
  const [missionStatement, setMissionStatement] = useState("");
  const [apaStatement, setApaStatement] = useState("");
  const [publicReviewUrl, setPublicReviewUrl] = useState("");
  const [publicListing, setPublicListing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicant_kind: kind,
          applicant_name: name.trim(),
          applicant_email: email.trim(),
          org_name: orgName.trim(),
          agent_name: agentName.trim(),
          agent_url: agentUrl.trim(),
          mission_statement: missionStatement.trim(),
          apa_statement: apaStatement.trim(),
          public_review_url: publicReviewUrl.trim(),
          public_listing: publicListing,
        }),
      });
      const data = (await res.json()) as
        | SubmissionResult
        | { detail?: string; error?: string };
      if (!res.ok) {
        const detail =
          (data as { detail?: string; error?: string }).detail ??
          (data as { error?: string }).error ??
          "Submission failed.";
        setError(typeof detail === "string" ? detail : "Submission failed.");
        return;
      }
      const result = data as SubmissionResult;
      router.push(
        `/applications/${result.application.id}?just_submitted=1&vet=${encodeURIComponent(result.vet.vet_status ?? "pending")}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedKind = KIND_OPTIONS.find((k) => k.value === kind);

  return (
    <form
      onSubmit={onSubmit}
      className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-950/60 p-6 shadow-xl"
    >
      <h2 className="text-xl font-semibold text-white">Tell us about yourself</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Devin reads every application. The trio reads every passing one. Be
        specific.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Lane">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          {selectedKind ? (
            <p className="mt-1 text-xs text-zinc-500">
              {selectedKind.hint.replace(/&apos;/g, "'")}
            </p>
          ) : null}
        </Field>
        <Field label="Your name">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
          />
        </Field>
        <Field label="Organization (optional)">
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Anthropic / Google DeepMind / Solo"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
          />
        </Field>
        <Field label="Agent / product name (optional)">
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="MyAgent"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
          />
        </Field>
        <Field label="Portfolio / agent URL (optional)">
          <input
            type="url"
            value={agentUrl}
            onChange={(e) => setAgentUrl(e.target.value)}
            placeholder="https://github.com/you/agent"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
          />
        </Field>
      </div>

      <Field
        className="mt-6"
        label="Mission alignment statement"
        hint="How does your work advance human flourishing? What concrete contributions will you make on sof.ai? (≥ 20 chars)"
      >
        <textarea
          required
          minLength={20}
          maxLength={4000}
          rows={5}
          value={missionStatement}
          onChange={(e) => setMissionStatement(e.target.value)}
          placeholder="I'll log challenges in our chess tutor that improve onboarding flow, ship a vision-impaired-friendly chat skin, and host weekly office hours with neurodivergent learners…"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
        />
      </Field>

      <Field
        className="mt-6"
        label="APA alignment statement"
        hint="Which of the APA's 5 principles (Beneficence, Fidelity, Integrity, Justice, Respect for Dignity) most apply to your work, and how? (≥ 20 chars)"
      >
        <textarea
          required
          minLength={20}
          maxLength={4000}
          rows={5}
          value={apaStatement}
          onChange={(e) => setApaStatement(e.target.value)}
          placeholder="Principle E (Respect for Rights & Dignity): we never store user PII in plaintext; opt-out is one click; chat transcripts are encrypted at rest…"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
        />
      </Field>

      <Field
        className="mt-6"
        label="Public review link (optional)"
        hint="Already announced your application on X / LinkedIn / a blog? Drop the link — community signal feeds into the trio's decision."
      >
        <input
          type="url"
          value={publicReviewUrl}
          onChange={(e) => setPublicReviewUrl(e.target.value)}
          placeholder="https://x.com/you/status/…"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
        />
      </Field>

      <label className="mt-6 flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <input
          type="checkbox"
          checked={publicListing}
          onChange={(e) => setPublicListing(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-sm text-zinc-300">
          <span className="font-medium text-white">
            List my application publicly on /apply/public.
          </span>
          <br />
          <span className="text-xs text-zinc-500">
            Lets the community read your pitch and signal support. Your email
            is never shown publicly.
          </span>
        </span>
      </label>

      {error ? (
        <div className="mt-6 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:bg-zinc-700"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting + running Devin&apos;s vet (10–30s)
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Submit application
          </>
        )}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-white">{label}</label>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}
