"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sparkles } from "lucide-react";
import { useToast } from "@/components/Toast";

export function SubmitArticleForm({ journalSlug }: { journalSlug: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [body, setBody] = useState("");
  const [coauthors, setCoauthors] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [intent, setIntent] = useState("");
  const [drafting, setDrafting] = useState(false);
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

  const onDraftFromUrl = async () => {
    if (drafting) return;
    const trimmed = sourceUrl.trim();
    if (!trimmed) {
      toast.push({
        message: "Paste a source URL above to draft from it.",
        tone: "info",
      });
      return;
    }
    setDrafting(true);
    try {
      const res = await fetch("/api/articles/draft-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_url: trimmed,
          journal_slug: journalSlug,
          title_hint: title.trim() || undefined,
          intent: intent.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        title?: string;
        abstract?: string;
        body?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.push({
          message: data.error ?? "Couldn't draft from that URL.",
          tone: "info",
        });
        return;
      }
      if (data.title) setTitle(data.title);
      if (data.abstract) setAbstract(data.abstract);
      if (data.body) setBody(data.body);
      toast.push({
        message:
          "Draft populated from your source URL — review and edit before submitting.",
        tone: "info",
      });
    } catch {
      toast.push({
        message: "Network error while drafting — please try again.",
        tone: "info",
      });
    } finally {
      setDrafting(false);
    }
  };

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
            body: body.trim(),
            coauthors: coauthors
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean),
            source_url: sourceUrl.trim() || undefined,
          }),
        },
      );
      const data = (await res.json()) as { id?: number; error?: string };
      if (!res.ok) {
        toast.push({
          message: data.error ?? "Couldn't submit the article.",
          tone: "info",
        });
        return;
      }
      toast.push({
        message: "Submission received · +50 Educoin® awarded.",
        tone: "info",
      });
      setTitle("");
      setAbstract("");
      setBody("");
      setCoauthors("");
      setSourceUrl("");
      setIntent("");
      router.refresh();
    } catch {
      toast.push({
        message: "Network error — please try again.",
        tone: "info",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3" data-testid="submit-article-form">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
          <Sparkles className="h-3 w-3" />
          Inspire from URL · optional
        </div>
        <p className="mt-1 text-[11px] text-zinc-400">
          Paste a public article you want to write a better version of. sof.ai
          will fetch it and use it as <em>inspiration</em> only — your draft
          will be original, anchored in your voice, and grounded in this
          journal&apos;s lens.
        </p>
        <input
          aria-label="Source URL (optional)"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://example.com/the-article-i-want-to-out-write"
          maxLength={2000}
          inputMode="url"
          type="url"
          data-testid="source-url-input"
          className="mt-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
        <input
          aria-label="What's your angle? (optional)"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="What's your angle? e.g. 'reframe PRs as a teaching primitive'"
          maxLength={600}
          className="mt-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
        <button
          type="button"
          onClick={onDraftFromUrl}
          disabled={drafting || sourceUrl.trim().length < 8}
          data-testid="draft-from-url-button"
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" />
          {drafting ? "Drafting from URL…" : "Draft from URL"}
        </button>
      </div>

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
      <textarea
        aria-label="Body (Markdown)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Body — Markdown is fine. Optional; reviewers can iterate later."
        rows={6}
        maxLength={200_000}
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
