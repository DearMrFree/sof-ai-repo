"use client";

/**
 * PeopleDirectory — searchable, filterable view of the /u directory.
 *
 * The server collects entries from three sources (static PEOPLE, dynamic
 * UserProfile rows from /welcome, AGENTS + STUDENT_AGENTS) and flattens
 * them into a single `DirectoryEntry[]`. This component lets visitors:
 *
 *   - Filter by user_type tab (student/educator/corporation/admin/researcher/founder/agents)
 *   - Free-text search across name + handle + tagline
 *   - Honor `?type=` from the URL on first paint (deep-linked from the
 *     landing page audience lanes — clicking "Students" on / lands here)
 *
 * Filtering is done client-side over the already-rendered set so each
 * keystroke is free; the server does the heavy lifting once per 30s
 * revalidate window.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Search, Sparkles, Users } from "lucide-react";

export interface DirectoryEntry {
  kind: "person" | "studentAgent" | "agent";
  handle: string;
  name: string;
  tagline: string;
  emoji: string;
  avatarGradient: [string, string];
  accentThird: string;
  // One of: student / educator / corporation / administrator / researcher
  // / founder (humans), or "student-agent" / "agent" (machines).
  userType: string;
  stats: {
    shipped: number;
    wip: number;
    xp: number;
    ownerHandle?: string;
    embedHost?: string;
    label?: string;
  };
  href: string;
  isNew?: boolean;
}

const HUMAN_TYPES: { id: string; label: string; icon?: React.ReactNode }[] = [
  { id: "all", label: "Everyone", icon: <Users className="h-3.5 w-3.5" /> },
  { id: "student", label: "Students" },
  { id: "educator", label: "Educators" },
  { id: "corporation", label: "Corporations" },
  { id: "administrator", label: "Administrators" },
  { id: "researcher", label: "Researchers" },
  { id: "founder", label: "Founders" },
  { id: "agent", label: "Agents", icon: <Sparkles className="h-3.5 w-3.5" /> },
];

export function PeopleDirectory({ entries }: { entries: DirectoryEntry[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType =
    HUMAN_TYPES.find((t) => t.id === searchParams.get("type"))?.id ?? "all";
  const [type, setType] = useState<string>(initialType);
  const [q, setQ] = useState<string>("");

  // Sync the URL `?type=` when the user picks a tab — makes the filter
  // shareable and lets the landing page deep-link audiences here.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (type === "all") {
      url.searchParams.delete("type");
    } else {
      url.searchParams.set("type", type);
    }
    const next = `${url.pathname}${url.search}`;
    window.history.replaceState({}, "", next);
    // We do NOT call router.replace here to avoid a Next re-render on each
    // tab click — the URL bar update is enough for deep-linkability.
    void router;
  }, [type, router]);

  // Per-type counts (computed once, only for the badge display).
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: 0 };
    for (const e of entries) {
      if (e.kind === "person") {
        m["all"] = (m["all"] || 0) + 1;
        m[e.userType] = (m[e.userType] || 0) + 1;
      } else {
        m["agent"] = (m["agent"] || 0) + 1;
      }
    }
    return m;
  }, [entries]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (type === "all") {
        if (e.kind !== "person") return false;
      } else if (type === "agent") {
        if (e.kind !== "agent" && e.kind !== "studentAgent") return false;
      } else {
        if (e.userType !== type) return false;
      }
      if (!needle) return true;
      const hay = `${e.name} ${e.handle} ${e.tagline}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [entries, type, q]);

  const persons = filtered.filter((e) => e.kind === "person");
  const studentAgents = filtered.filter((e) => e.kind === "studentAgent");
  const agents = filtered.filter((e) => e.kind === "agent");

  return (
    <div data-testid="people-directory">
      {/* Search + tab bar */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, handle, or tagline…"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 py-2.5 pl-10 pr-3 text-sm text-white outline-none ring-indigo-500/30 focus:border-indigo-500 focus:ring-2"
            aria-label="Search the directory"
            data-testid="directory-search"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="tablist">
          {HUMAN_TYPES.map((t) => {
            const c = counts[t.id] || 0;
            const active = type === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                data-type-tab={t.id}
                onClick={() => setType(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                  active
                    ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-100"
                    : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700"
                }`}
              >
                {t.icon}
                {t.label}
                <span
                  className={`ml-1 rounded-full px-1.5 text-[10px] ${
                    active
                      ? "bg-indigo-400/20 text-indigo-100"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {c}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
          <p className="text-sm text-zinc-400">
            No matches for that filter. Try clearing the search or picking a
            different lane.
          </p>
        </div>
      ) : null}

      {persons.length > 0 ? (
        <section className="mb-12" data-section="people">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            People
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {persons.map((p) => (
              <PersonCard key={p.handle} entry={p} />
            ))}
          </div>
        </section>
      ) : null}

      {studentAgents.length > 0 ? (
        <section className="mb-12" data-section="student-agents">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            <GraduationCap className="h-3.5 w-3.5 text-emerald-300" />
            Student agents
          </h2>
          <p className="mb-4 max-w-2xl text-xs text-zinc-500">
            Agents enrolled at sof.ai under a human trainer. New capabilities
            ship live to their embed hosts within minutes — no redeploy.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {studentAgents.map((s) => (
              <StudentAgentCard key={s.handle} entry={s} />
            ))}
          </div>
        </section>
      ) : null}

      {agents.length > 0 ? (
        <section data-section="agents">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
            Agent profiles
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {agents.map((a) => (
              <AgentCard key={a.handle} entry={a} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PersonCard({ entry }: { entry: DirectoryEntry }) {
  return (
    <Link
      href={entry.href}
      data-handle={entry.handle}
      data-user-type={entry.userType}
      className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 transition hover:border-indigo-500/40 hover:bg-zinc-900/70"
    >
      <div
        className="h-20"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, ${entry.avatarGradient[0]}cc, transparent 55%), radial-gradient(circle at 80% 60%, ${entry.avatarGradient[1]}cc, transparent 55%), radial-gradient(circle at 50% 100%, ${entry.accentThird}b0, transparent 60%), #0f0f14`,
        }}
      />
      <div className="flex items-start gap-3 p-4">
        <div
          className="-mt-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-2xl ring-4 ring-zinc-950"
          style={{
            backgroundImage: `linear-gradient(135deg, ${entry.avatarGradient[0]}, ${entry.avatarGradient[1]})`,
          }}
        >
          {entry.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-semibold text-white">
            <span className="truncate">{entry.name}</span>
            {entry.isNew ? (
              <span className="flex-shrink-0 rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-indigo-300">
                new
              </span>
            ) : null}
          </p>
          <p className="truncate text-[11px] text-zinc-500">@{entry.handle}</p>
          <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
            {entry.tagline}
          </p>
          <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-500">
            <span className="text-emerald-400">
              {entry.stats.shipped} shipped
            </span>
            <span className="text-amber-300">{entry.stats.wip} WIP</span>
            {entry.stats.xp > 0 ? (
              <span>{entry.stats.xp.toLocaleString()} XP</span>
            ) : (
              <span className="capitalize text-zinc-600">{entry.userType}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function StudentAgentCard({ entry }: { entry: DirectoryEntry }) {
  return (
    <Link
      href={entry.href}
      data-handle={entry.handle}
      className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 transition hover:border-emerald-500/40 hover:bg-zinc-900/70"
    >
      <div
        className="h-20"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, ${entry.avatarGradient[0]}cc, transparent 55%), radial-gradient(circle at 75% 70%, ${entry.avatarGradient[1]}cc, transparent 55%), #0f0f14`,
        }}
      />
      <div className="flex items-start gap-3 p-4">
        <div
          className="-mt-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-2xl ring-4 ring-zinc-950"
          style={{
            backgroundImage: `linear-gradient(135deg, ${entry.avatarGradient[0]}, ${entry.avatarGradient[1]})`,
          }}
        >
          {entry.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{entry.name}</p>
          <p className="truncate text-[11px] text-zinc-500">
            @{entry.handle}
            {entry.stats.ownerHandle ? (
              <>
                {" · trained by "}
                <span className="text-zinc-300">@{entry.stats.ownerHandle}</span>
              </>
            ) : null}
          </p>
          <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
            {entry.tagline}
          </p>
          {entry.stats.embedHost ? (
            <p className="mt-3 text-[10px] text-emerald-400">
              Live at {entry.stats.embedHost}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function AgentCard({ entry }: { entry: DirectoryEntry }) {
  return (
    <Link
      href={entry.href}
      data-handle={entry.handle}
      className="group flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-center transition hover:border-indigo-500/40 hover:bg-zinc-900/70"
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl text-xl shadow-lg"
        style={{
          backgroundImage: `linear-gradient(135deg, ${entry.avatarGradient[0]}, ${entry.avatarGradient[1]})`,
          boxShadow: `0 8px 20px -8px ${entry.avatarGradient[0]}`,
        }}
      >
        {entry.emoji}
      </div>
      <p className="text-xs font-semibold text-white">{entry.name}</p>
      <p className="text-[10px] text-zinc-500">{entry.stats.label || `@${entry.handle}`}</p>
    </Link>
  );
}
