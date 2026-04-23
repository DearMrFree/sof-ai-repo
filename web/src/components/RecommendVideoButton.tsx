"use client";

import { useState } from "react";
import {
  Video,
  ExternalLink,
  BookOpen,
  Code2,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";

interface Recommendation {
  id: string;
  kind: "video" | "repo" | "guide" | "book" | "doc";
  title: string;
  url: string;
  blurb: string;
  source?: string;
  duration?: string;
  reason: "curated" | "ai";
}

interface RecommendVideoButtonProps {
  /** Human-friendly label for the button. */
  label?: string;
  /** Context passed to the recommender. */
  topic?: string;
  lessonSlug?: string;
  lessonTitle?: string;
  programSlug?: string;
  challenge?: string;
  /** Max recommendations. Defaults to 3. */
  limit?: number;
}

const KIND_ICON = {
  video: Video,
  repo: Code2,
  guide: BookOpen,
  book: BookOpen,
  doc: FileText,
} as const;

export function RecommendVideoButton({
  label = "Recommend me a video",
  topic,
  lessonSlug,
  lessonTitle,
  programSlug,
  challenge,
  limit = 3,
}: RecommendVideoButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);

  async function fetchRecs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          lessonSlug,
          lessonTitle,
          programSlug,
          challenge,
          limit,
        }),
      });
      if (res.status === 401) {
        setError("Sign in to get recommendations.");
        return;
      }
      if (!res.ok) {
        setError("Couldn't load recommendations right now.");
        return;
      }
      const data = (await res.json()) as { recommendations?: Recommendation[] };
      const list = Array.isArray(data.recommendations) ? data.recommendations : [];
      if (list.length === 0) {
        setError("No matching resources yet — check back as the catalog grows.");
        return;
      }
      setRecs(list);
    } catch {
      setError("Network hiccup. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/70 to-zinc-950/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
            <Sparkles className="h-3 w-3" />
            Recommendations
          </div>
          <h3 className="mt-2 text-sm font-semibold text-white">
            Need a different angle on this?
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            Get a curated YouTube video, repo, or guide matched to what you&apos;re on right now.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchRecs}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Finding…
            </>
          ) : (
            <>
              <Video className="h-4 w-4" />
              {label}
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-amber-400" role="alert">
          {error}
        </p>
      )}

      {recs && recs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {recs.map((r) => {
            const Icon = KIND_ICON[r.kind] ?? FileText;
            return (
              <li
                key={r.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3"
              >
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-sm font-medium text-white group-hover:underline">
                        {r.title}
                        <ExternalLink className="h-3 w-3 shrink-0 text-zinc-500" />
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">{r.blurb}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                        <span className="uppercase tracking-wider">{r.kind}</span>
                        {r.duration && <span>· {r.duration}</span>}
                        {r.source && <span>· {r.source}</span>}
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-indigo-400">
                          {r.reason === "ai" ? "AI-picked" : "Curated"}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
