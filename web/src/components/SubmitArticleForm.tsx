"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";

export function SubmitArticleForm({ journalSlug }: { journalSlug: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [coauthors, setCoauthors] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "loading") {
    return <div className="h-10 animate-pulse rounded-md bg-zinc-900" />;
  }
  if (!session?.user) {
    return (
      <a
        href={`/signin?next=/journals/${journalSlug}`}
        className="inline-flex w-full items-center justify-center rounded-md bg-teal-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-teal-400"
      >
        Sign in to submit
      </a>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/journals/${encodeURIComponent(journalSlug)}/articles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            abstract: abstract.trim(),
            body: "",
            coauthors: coauthors
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean),
          }),
        },
      );
      const data = (await res.json()) as { id?: number; error?: string };
      if (!res.ok) {
        toast.push({ message: data.error ?? "Couldn't submit the article.", tone: "info" });
        return;
      }
      toast.push({ message: "Submission received · +50 Educoin® awarded.", tone: "info" });
      setTitle("");
      setAbstract("");
      setCoauthors("");
      router.refresh();
    } catch {
      toast.push({ message: "Network error — please try again.", tone: "info" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        aria-label="Article title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Article title"
        maxLength={300}
        required
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
      <textarea
        aria-label="Abstract"
        value={abstract}
        onChange={(e) => setAbstract(e.target.value)}
        placeholder="Abstract — 2-3 sentences is fine for v1"
        rows={3}
        maxLength={4000}
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
      <input
        aria-label="Co-authors"
        value={coauthors}
        onChange={(e) => setCoauthors(e.target.value)}
        placeholder="Co-authors (comma-separated: user:uuid, agent:devin)"
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
      <button
        type="submit"
        disabled={submitting || title.trim().length < 2}
        className="w-full rounded-md bg-gradient-to-r from-teal-500 to-sky-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit · +50 EDU"}
      </button>
    </form>
  );
}
