"use client";

import { useMemo, useState } from "react";
import { Build, BuildStatus, countByStatus } from "@/lib/builds";
import { BuildCard } from "@/components/BuildCard";
import { cn } from "@/lib/cn";

type Filter = "all" | BuildStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "shipped", label: "Shipped" },
  { id: "in-progress", label: "In progress" },
  { id: "draft", label: "Drafts" },
];

export function BuildGrid({ builds }: { builds: Build[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = useMemo(() => countByStatus(builds), [builds]);
  const filtered = useMemo(
    () => (filter === "all" ? builds : builds.filter((b) => b.status === filter)),
    [builds, filter],
  );

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-white">Builds</h2>
          <p className="text-xs text-zinc-500">
            {builds.length} total · an App Store of what this learner has made
          </p>
        </div>
      </div>

      <div
        className="mb-4 inline-flex flex-wrap items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1"
        role="tablist"
      >
        {FILTERS.map((f) => {
          const count =
            f.id === "all" ? builds.length : counts[f.id as BuildStatus] ?? 0;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "bg-zinc-900 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.4)]"
                  : "text-zinc-400 hover:text-white",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px]",
                  active ? "bg-indigo-500/30 text-indigo-100" : "bg-zinc-900 text-zinc-500",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 p-10 text-center">
          <p className="text-sm text-zinc-400">
            No {filter === "all" ? "" : filter.replace("-", " ")} builds yet.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Builds appear here as lessons, PRs, and write-ups ship.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <BuildCard key={b.id} build={b} />
          ))}
        </div>
      )}
    </section>
  );
}
