"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { Megaphone, X } from "lucide-react";
import { useToast } from "@/components/Toast";


type Tag = "confusing" | "broken" | "missing" | "question" | "idea";

const TAGS: { id: Tag; label: string; emoji: string; blurb: string }[] = [
  { id: "confusing", label: "Confusing UI", emoji: "🤔", blurb: "I got lost or didn't know what to do next." },
  { id: "broken", label: "Something broke", emoji: "🐛", blurb: "A button did nothing / an error / crash." },
  { id: "missing", label: "Missing feature", emoji: "🧩", blurb: "I wanted X; it doesn't exist yet." },
  { id: "question", label: "Question", emoji: "❓", blurb: "I'd like to understand something better." },
  { id: "idea", label: "Design idea", emoji: "💡", blurb: "Here's a better way to do it." },
];

type Mode = "authed" | "public";

/**
 * Floating feedback button. Opens a modal where any user — signed in or
 * not — can log a "challenge" (a friction point, bug, missing feature,
 * question, or idea).
 *
 * Authenticated users get the full 2000-char form (endpoint `/api/challenges`).
 * Public users get a simplified modal that asks for email + name + body + tag
 * and posts to `/api/challenges/public`, which applies honeypot and rate limits.
 */
export function ChallengeButton() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState<Tag>("confusing");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  // Honeypot — must stay empty. Rendered visually hidden so real users
  // can't fill it, while naive bots will populate every <input>.
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const mode: Mode = session?.user ? "authed" : "public";
  const bodyCap = mode === "authed" ? 2000 : 1000;

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  function resetFields() {
    setBody("");
    setEmail("");
    setName("");
    setWebsite("");
  }

  async function submit() {
    const trimmed = body.trim();
    if (trimmed.length < 3) {
      toast.push({ tone: "error", message: "Please write a few words." });
      return;
    }
    if (mode === "public") {
      const emailTrimmed = email.trim();
      if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
        toast.push({
          tone: "error",
          message: "Please enter a valid email so we can credit your feedback.",
        });
        return;
      }
    }

    setSubmitting(true);
    const learnMatch = pathname?.match(
      /^\/learn\/([^/]+)(?:\/([^/]+))?\/?$/,
    );
    const programSlug = learnMatch?.[1] ?? null;
    const lessonSlug = learnMatch?.[2] ?? null;
    const pageUrl = typeof window !== "undefined" ? window.location.href : null;
    try {
      const endpoint =
        mode === "authed" ? "/api/challenges" : "/api/challenges/public";
      const payload =
        mode === "authed"
          ? {
              body: trimmed,
              tag,
              page_url: pageUrl,
              program_slug: programSlug,
              lesson_slug: lessonSlug,
            }
          : {
              email: email.trim(),
              name: name.trim() || null,
              body: trimmed,
              tag,
              page_url: pageUrl,
              program_slug: programSlug,
              lesson_slug: lessonSlug,
              website,
            };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `HTTP ${res.status}`);
      }
      toast.push({
        tone: "success",
        message:
          mode === "public"
            ? "Thanks! Your feedback goes straight to the triage board."
            : "Logged. Thanks — this goes straight to the build list.",
      });
      resetFields();
      setOpen(false);
    } catch (err) {
      toast.push({
        tone: "error",
        message:
          "Couldn't submit just now. " +
          (err instanceof Error ? err.message : ""),
      });
    } finally {
      setSubmitting(false);
    }
  }

  const handleLabel =
    mode === "authed"
      ? `@${session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "you"}`
      : name.trim() || (email.includes("@") ? `@${email.split("@")[0]}` : "@guest");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          mode === "authed"
            ? "sof-lift fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-2xl shadow-indigo-500/30 transition hover:brightness-110"
            : "fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-zinc-950/80 px-4 py-2 text-sm font-medium text-indigo-200 shadow-2xl shadow-indigo-500/20 backdrop-blur transition hover:bg-zinc-900"
        }
      >
        <Megaphone className="h-4 w-4" />
        Log a challenge
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-indigo-300" />
                <h2 className="text-sm font-semibold text-white">
                  Log a challenge
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <p className="text-xs text-zinc-400">
                Anything friction-y — a confusing screen, a bug, a missing
                feature, a question, a design idea. Every entry goes on the
                triage board and shapes what ships next.
              </p>

              {mode === "public" && (
                <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 px-3 py-2 text-[11px] text-indigo-200">
                  Want full access?{" "}
                  <button
                    type="button"
                    onClick={() => signIn()}
                    className="underline hover:text-white"
                  >
                    Sign in
                  </button>{" "}
                  to track your feedback and earn Educoin.{" "}
                  <Link href="/signin" className="underline hover:text-white">
                    Create an account
                  </Link>
                  .
                </div>
              )}

              {mode === "public" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="challenge-email"
                      className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                    >
                      Email
                    </label>
                    <input
                      id="challenge-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="challenge-name"
                      className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                    >
                      Name (optional)
                    </label>
                    <input
                      id="challenge-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ada Lovelace"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {mode === "public" && (
                // Honeypot — visually hidden but kept out of the tab order
                // and flagged to accessibility tech. A bot that fills every
                // input will trip it; real users won't even see it.
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-[-9999px] top-[-9999px] h-0 w-0 opacity-0"
                >
                  <label htmlFor="challenge-website">Website</label>
                  <input
                    id="challenge-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  What kind?
                </label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                  {TAGS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTag(t.id)}
                      className={`flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition ${
                        tag === t.id
                          ? "border-indigo-400 bg-indigo-500/10 text-white"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <span className="text-lg leading-none">{t.emoji}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-zinc-500">
                  {TAGS.find((t) => t.id === tag)?.blurb}
                </p>
              </div>

              <div>
                <label
                  htmlFor="challenge-body"
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                >
                  What&apos;s up?
                </label>
                <textarea
                  id="challenge-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  maxLength={bodyCap}
                  placeholder="One sentence is enough. What tripped you up?"
                  className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>
                    You&apos;re logging as{" "}
                    <span className="text-zinc-300">{handleLabel}</span>
                  </span>
                  <span>
                    {body.length}/{bodyCap}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 bg-zinc-900/60 px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || body.trim().length < 3}
                className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Log it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
