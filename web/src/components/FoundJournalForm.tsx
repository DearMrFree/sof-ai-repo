"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";

/**
 * Compact form that creates a new journal. Auth-gated in the proxy —
 * we show a friendly sign-in nudge if the user isn't signed in rather
 * than a 401 toast.
 */
export function FoundJournalForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          topic_tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const data = (await res.json()) as { slug?: string; error?: string };
      if (!res.ok) {
        toast.push({ message: data.error ?? "Couldn't create the journal.", tone: "info" });
        return;
      }
      toast.push({ message: `Journal founded · +300 Educoin® to your wallet.`, tone: "info" });
      setTitle("");
      setDescription("");
      setTags("");
      if (data.slug) {
        router.push(`/journals/${data.slug}`);
      } else {
        router.refresh();
      }
    } catch {
      toast.push({ message: "Network error — please try again.", tone: "info" });
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return <div className="h-10 animate-pulse rounded-md bg-zinc-900" />;
  }
  if (!session?.user) {
    return (
      <a
        href="/signin?next=/journals"
        className="inline-flex w-full items-center justify-center rounded-md bg-teal-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-teal-400"
      >
        Sign in to found a journal
      </a>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        aria-label="Journal title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Journal title (e.g. Agentic Methods in Education)"
        maxLength={200}
        required
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
      <textarea
        aria-label="Scope and mission"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Scope, mission, what kind of papers are you looking for?"
        maxLength={2000}
        rows={3}
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
      <input
        aria-label="Topic tags"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="Tags (comma-separated): agents, education, ai"
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
      <button
        type="submit"
        disabled={submitting || title.trim().length < 2}
        className="w-full rounded-md bg-gradient-to-r from-teal-500 to-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Founding…" : "Found journal · +300 EDU"}
      </button>
    </form>
  );
}
