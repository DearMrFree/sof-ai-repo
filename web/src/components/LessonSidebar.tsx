"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { ProgressState, readProgress } from "@/lib/progress";
import { cn } from "@/lib/cn";

export interface SidebarProgram {
  slug: string;
  title: string;
  modules: {
    slug: string;
    title: string;
    lessons: { slug: string; title: string }[];
  }[];
}

export function LessonSidebar({
  program,
  activeLessonSlug,
}: {
  program: SidebarProgram;
  activeLessonSlug: string;
}) {
  const [progress, setProgress] = useState<ProgressState>({});
  useEffect(() => {
    setProgress(readProgress());
  }, [activeLessonSlug]);

  return (
    <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="border-b border-zinc-900 px-4 py-4">
        <Link
          href={`/learn/${program.slug}`}
          className="text-xs uppercase tracking-wider text-indigo-400 hover:text-indigo-300"
        >
          Program
        </Link>
        <p className="mt-1 text-sm font-semibold text-white">{program.title}</p>
      </div>
      <nav className="px-2 py-3">
        {program.modules.map((m, mi) => (
          <div key={m.slug} className="mb-3">
            <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
              M{mi + 1} · {m.title}
            </p>
            <ul className="space-y-0.5">
              {m.lessons.map((l, li) => {
                const done = !!progress[program.slug]?.[l.slug]?.completedAt;
                const active = l.slug === activeLessonSlug;
                return (
                  <li key={l.slug}>
                    <Link
                      href={`/learn/${program.slug}/${l.slug}`}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition",
                        active
                          ? "bg-indigo-500/15 text-white"
                          : "text-zinc-400 hover:bg-zinc-900 hover:text-white",
                      )}
                    >
                      {done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 flex-shrink-0 text-zinc-700" />
                      )}
                      <span className="truncate">
                        {li + 1}. {l.title}
                      </span>
                      {active && (
                        <ChevronRight className="ml-auto h-3.5 w-3.5 text-indigo-400" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
