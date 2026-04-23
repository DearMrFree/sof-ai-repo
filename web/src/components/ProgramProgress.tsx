"use client";

import { useEffect, useState } from "react";
import { programCompletionPct, readProgress } from "@/lib/progress";

export function ProgramProgress({
  programSlug,
  totalLessons,
}: {
  programSlug: string;
  totalLessons: number;
}) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const state = readProgress();
    setPct(programCompletionPct(state, programSlug, totalLessons));
  }, [programSlug, totalLessons]);

  return (
    <div className="mt-5">
      <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-400">
        <span>Your progress</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
