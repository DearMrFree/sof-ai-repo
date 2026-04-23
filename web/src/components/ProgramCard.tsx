"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, GraduationCap } from "lucide-react";
import { programCompletionPct, readProgress } from "@/lib/progress";

export function ProgramCard(props: {
  slug: string;
  title: string;
  tagline: string;
  heroEmoji?: string;
  poweredBy?: string;
  totalModules: number;
  totalLessons: number;
  totalWeeks?: number;
}) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const state = readProgress();
    setPct(programCompletionPct(state, props.slug, props.totalLessons));
  }, [props.slug, props.totalLessons]);

  return (
    <Link
      href={`/learn/${props.slug}`}
      className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 transition hover:border-indigo-500/50"
    >
      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xl">
            {props.heroEmoji ?? "🎓"}
          </div>
          {props.poweredBy && (
            <div className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
              <Bot className="h-3 w-3 text-indigo-400" />
              Powered by {props.poweredBy}
            </div>
          )}
        </div>
        <h3 className="text-xl font-semibold text-white">{props.title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{props.tagline}</p>

        <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="h-3.5 w-3.5" />
            {props.totalModules} modules · {props.totalLessons} lessons
          </span>
          {props.totalWeeks && <span>{props.totalWeeks} weeks</span>}
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
