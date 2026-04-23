"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { isLessonComplete, markLessonComplete, readProgress } from "@/lib/progress";

export function LessonFooter({
  programSlug,
  lessonSlug,
  lessonTitle,
  prev,
  next,
}: {
  programSlug: string;
  lessonSlug: string;
  lessonTitle: string;
  prev: { title: string; href: string } | null;
  next: { title: string; href: string } | null;
}) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const state = readProgress();
    setDone(isLessonComplete(state, programSlug, lessonSlug));
  }, [programSlug, lessonSlug]);

  function toggle() {
    if (done) {
      // unmark
      const state = readProgress();
      if (state[programSlug]) delete state[programSlug][lessonSlug];
      window.localStorage.setItem("sof.ai:progress:v1", JSON.stringify(state));
      setDone(false);
    } else {
      markLessonComplete(programSlug, lessonSlug);
      setDone(true);
    }
  }

  return (
    <div className="mt-12 border-t border-zinc-800 pt-8">
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">
            Finished <span className="text-indigo-400">{lessonTitle}</span>?
          </p>
          <p className="text-xs text-zinc-400">
            Mark it complete to track your progress.
          </p>
        </div>
        <button
          onClick={toggle}
          className={
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition " +
            (done
              ? "border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              : "bg-indigo-500 text-white hover:bg-indigo-400")
          }
        >
          {done ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Completed
            </>
          ) : (
            <>
              <Circle className="h-4 w-4" />
              Mark complete
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {prev ? (
          <Link
            href={prev.href}
            className="group flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-indigo-500/50"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-500 group-hover:text-indigo-400" />
            <div>
              <p className="text-xs text-zinc-500">Previous</p>
              <p className="text-sm font-medium text-white">{prev.title}</p>
            </div>
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link
            href={next.href}
            className="group flex items-center justify-end gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-right transition hover:border-indigo-500/50"
          >
            <div>
              <p className="text-xs text-zinc-500">Next up</p>
              <p className="text-sm font-medium text-white">{next.title}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-indigo-400" />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
