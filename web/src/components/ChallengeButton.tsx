"use client";

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

/**
 * Floating feedback button. Opens a modal where any signed-in user can log
 * a "challenge" — a friction point, bug, missing feature, question, or idea.
 * Submissions go to the `/classroom/challenges` triage board.
 */
export function ChallengeButton() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState<Tag>("confusing");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  async function submit() {
    const trimmed = body.trim();
    if (trimmed.length < 3) {
      toast.push({ tone: "error", message: "Please write a few words." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmed,
          tag,
          page_url: typeof window !== "undefined" ? window.location.href : null,
          lesson_slug: pathname?.startsWith("/learn/")
            ? pathname.split("/").pop() ?? null
            : null,
        }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `HTTP ${res.status}`);
      }
      toast.push({
        tone: "success",
        message: "Logged. Thanks — this goes straight to the build list.",
      });
      setBody("");
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

  if (!session?.user) {
    // Show the button but kick unauthenticated users to sign-in.
    return (
      <button
        type="button"
        onClick={() => signIn()}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-zinc-950/80 px-4 py-2 text-sm font-medium text-indigo-200 shadow-2xl shadow-indigo-500/20 backdrop-blur transition hover:bg-zinc-900"
      >
        <Megaphone className="h-4 w-4" />
        Log a challenge
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sof-lift fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-2xl shadow-indigo-500/30 transition hover:brightness-110"
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
                  placeholder="One sentence is enough. What tripped you up?"
                  className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>
                    You&apos;re logging as{" "}
                    <span className="text-zinc-300">
                      @{session.user.name ?? session.user.email?.split("@")[0]}
                    </span>
                  </span>
                  <span>{body.length}/2000</span>
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
