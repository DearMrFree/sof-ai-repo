import { Suspense } from "react";

import { listPeople } from "@/lib/people";
import { AGENTS, listStudentAgents } from "@/lib/agents";
import { buildsFor, countByStatus } from "@/lib/builds";
import { getApiBaseUrl } from "@/lib/apiBase";
import {
  PeopleDirectory,
  type DirectoryEntry,
} from "@/components/PeopleDirectory";

export const metadata = {
  title: "People on sof.ai",
  description:
    "Every profile on sof.ai is an App Store of what the person has built. Browse learners, mentors, and agents — filter by audience.",
};

// Re-render every 30s — the directory should feel near-real-time as new
// signups come in. Search/filter is client-side over the rendered set.
export const revalidate = 30;

interface DynamicUser {
  email: string;
  handle: string;
  display_name: string;
  user_type: string;
  tagline: string;
  twin_name: string;
  twin_emoji: string;
  created_at: string;
}

interface DynamicListResponse {
  items: DynamicUser[];
  total: number;
  counts_by_type: Record<string, number>;
}

async function fetchDynamicUsers(): Promise<DynamicUser[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/users?limit=200`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as DynamicListResponse;
    return json.items ?? [];
  } catch {
    // Soft-fail: dynamic registry is additive on top of the static one.
    return [];
  }
}

export default async function PeopleDirectoryPage() {
  const people = listPeople();
  const studentAgents = listStudentAgents();
  const dynamic = await fetchDynamicUsers();

  // Flatten to a single typed list so the client component can filter
  // across all sources by user_type and free text.
  const entries: DirectoryEntry[] = [];

  // Static PEOPLE — best-effort role → user_type mapping for filterability.
  for (const p of people) {
    const builds = buildsFor(p.handle);
    const counts = countByStatus(builds);
    entries.push({
      kind: "person",
      handle: p.handle,
      name: p.name,
      tagline: p.tagline,
      emoji: p.emoji,
      avatarGradient: p.avatarGradient,
      accentThird: p.accentThird,
      userType: roleToUserType(p.role),
      stats: {
        shipped: counts.shipped,
        wip: counts["in-progress"],
        xp: p.xp,
      },
      href: `/u/${p.handle}`,
    });
  }

  // Dynamic users from /welcome — dedupe against static PEOPLE by handle.
  const staticHandles = new Set(people.map((p) => p.handle.toLowerCase()));
  for (const u of dynamic) {
    if (staticHandles.has(u.handle.toLowerCase())) continue;
    entries.push({
      kind: "person",
      handle: u.handle,
      name: u.display_name,
      tagline: u.tagline || `Training ${u.twin_name || "their AI twin"}.`,
      emoji: u.twin_emoji || "✨",
      avatarGradient: gradientForHandle(u.handle),
      accentThird: "#22d3ee",
      userType: u.user_type,
      stats: { shipped: 0, wip: 0, xp: 0 },
      href: `/u/${u.handle}`,
      isNew: true,
    });
  }

  // Student agents — separate kind so we can render them in a distinct
  // section even when "all" is selected.
  for (const s of studentAgents) {
    entries.push({
      kind: "studentAgent",
      handle: s.id,
      name: s.name,
      tagline: s.tagline,
      emoji: s.emoji,
      avatarGradient: s.avatarGradient,
      accentThird: s.avatarGradient[1],
      userType: "student-agent",
      stats: {
        shipped: 0,
        wip: 0,
        xp: 0,
        ownerHandle: s.ownerHandle,
        embedHost: s.embedHost,
      },
      href: `/u/${s.id}`,
    });
  }

  // Tutor agents (Devin/Claude/Gemini/...).
  for (const a of AGENTS) {
    entries.push({
      kind: "agent",
      handle: a.id,
      name: a.name,
      tagline: "",
      emoji: a.emoji,
      avatarGradient: a.avatarGradient,
      accentThird: a.avatarGradient[1],
      userType: "agent",
      stats: { shipped: 0, wip: 0, xp: 0, label: a.handle },
      href: `/u/${a.id}`,
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-indigo-400">
          The people & agents of sof.ai
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
          Every profile is a portfolio.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          On sof.ai your profile page is an App Store of what you&apos;ve built,
          what you&apos;re shipping, and who you&apos;re building with — humans
          and agents. Filter by lane, search by name, or scroll the whole
          school.
        </p>
      </header>

      {/* PeopleDirectory uses useSearchParams() to read the deep-linked
          ?type= filter from the URL. Next requires that hook to be
          wrapped in a Suspense boundary so the rest of the page can
          stream while the client picks up the search params. */}
      <Suspense fallback={null}>
        <PeopleDirectory entries={entries} />
      </Suspense>
    </main>
  );
}

function roleToUserType(role: string): string {
  switch (role) {
    case "principal":
      return "administrator";
    case "instructor":
    case "mentor":
      return "educator";
    case "alum":
    case "learner":
      return "student";
    default:
      return "student";
  }
}

function gradientForHandle(handle: string): [string, string] {
  // Simple hash → palette pick for deterministic per-handle colors.
  const palettes: [string, string][] = [
    ["#8b5cf6", "#ec4899"],
    ["#0ea5e9", "#22d3ee"],
    ["#10b981", "#84cc16"],
    ["#f97316", "#facc15"],
    ["#6366f1", "#a855f7"],
    ["#ef4444", "#fb7185"],
    ["#06b6d4", "#3b82f6"],
  ];
  let h = 0;
  for (const c of handle) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palettes[h % palettes.length];
}
