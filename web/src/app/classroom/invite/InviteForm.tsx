"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send } from "lucide-react";
import { useToast } from "@/components/Toast";

interface Program {
  slug: string;
  title: string;
}

const ROLES: { id: string; label: string; blurb: string }[] = [
  {
    id: "contributor",
    label: "Contributor",
    blurb: "UI/UX reviewer, feedback author, occasional PR.",
  },
  {
    id: "reviewer",
    label: "Reviewer",
    blurb: "Reviews Devin-authored PRs, catches regressions.",
  },
  {
    id: "mentor",
    label: "Mentor",
    blurb: "Pairs with cohort learners on capstones.",
  },
  {
    id: "learner",
    label: "Learner",
    blurb: "Enrolls in a program and ships capstones.",
  },
];

export function InviteForm({ programs }: { programs: Program[] }) {
  const toast = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("contributor");
  const [programSlug, setProgramSlug] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.push({ tone: "error", message: "Please enter a valid email." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          name: name.trim() || null,
          role,
          program_slug: programSlug || null,
          message: message.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      toast.push({
        tone: "success",
        message: `Invite minted for ${trimmedEmail}. Copy the /invite/<token> link from the list.`,
      });
      setEmail("");
      setName("");
      setMessage("");
      setProgramSlug("");
      router.refresh();
    } catch (err) {
      toast.push({
        tone: "error",
        message:
          "Couldn't send invite. " + (err instanceof Error ? err.message : ""),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
    >
      <h2 className="text-sm font-semibold text-white">New invitation</h2>
      <p className="mt-1 text-[11px] text-zinc-500">
        All fields honored by FastAPI&apos;s /invitations endpoint. Expires
        7 days from now.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="invite-email"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
          >
            Email *
          </label>
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label
            htmlFor="invite-name"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
          >
            Name
          </label>
          <input
            id="invite-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Role
        </label>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {ROLES.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => setRole(r.id)}
              className={`flex flex-col items-start rounded-lg border px-2.5 py-2 text-left text-[11px] transition ${
                role === r.id
                  ? "border-indigo-400 bg-indigo-500/10 text-white"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              <span className="font-semibold">{r.label}</span>
              <span className="text-[10px] text-zinc-500">{r.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label
          htmlFor="invite-program"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
        >
          Program (optional)
        </label>
        <select
          id="invite-program"
          value={programSlug}
          onChange={(e) => setProgramSlug(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Platform-wide access</option>
          {programs.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label
          htmlFor="invite-message"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
        >
          Personal message (optional)
        </label>
        <textarea
          id="invite-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="One line on why you're inviting them."
          className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="sof-lift inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {submitting ? "Sending…" : "Send invite"}
        </button>
      </div>
    </form>
  );
}
