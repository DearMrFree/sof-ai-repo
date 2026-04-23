"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Award,
  Bot,
  CheckCircle2,
  Flame,
  GraduationCap,
  Star,
  Trophy,
} from "lucide-react";
import { ProgressState, readProgress } from "@/lib/progress";
import { AGENTS } from "@/lib/agents";
import { AgentAvatar } from "@/components/AgentAvatar";

interface Achievement {
  id: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  unlocked: boolean;
  earnedFrom?: string; // agent id
}

export default function PortfolioPage() {
  const { data } = useSession();
  const [progress, setProgress] = useState<ProgressState>({});

  useEffect(() => {
    setProgress(readProgress());
  }, []);

  const totalCompleted = Object.values(progress).reduce(
    (acc, byLesson) => acc + Object.keys(byLesson).length,
    0,
  );

  const achievements: Achievement[] = [
    {
      id: "first-lesson",
      title: "First light",
      body: "Completed your first lesson.",
      icon: <Star className="h-5 w-5" />,
      unlocked: totalCompleted >= 1,
      earnedFrom: "claude",
    },
    {
      id: "5-lessons",
      title: "Getting serious",
      body: "Completed 5 lessons.",
      icon: <Flame className="h-5 w-5" />,
      unlocked: totalCompleted >= 5,
      earnedFrom: "claude",
    },
    {
      id: "first-capstone",
      title: "Shipped with Devin",
      body: "Launched your first Devin capstone.",
      icon: <Bot className="h-5 w-5" />,
      unlocked: false,
      earnedFrom: "devin",
    },
    {
      id: "module-done",
      title: "Module closer",
      body: "Completed every lesson in a module.",
      icon: <Award className="h-5 w-5" />,
      unlocked: false,
      earnedFrom: "gemini",
    },
    {
      id: "peer-review",
      title: "Good neighbor",
      body: "Reviewed a peer's PR.",
      icon: <CheckCircle2 className="h-5 w-5" />,
      unlocked: false,
      earnedFrom: "llama",
    },
    {
      id: "classroom",
      title: "Joined the classroom of the future",
      body: "Signed in to sof.ai.",
      icon: <Trophy className="h-5 w-5" />,
      unlocked: !!data?.user,
      earnedFrom: "grok",
    },
  ];

  const unlocked = achievements.filter((a) => a.unlocked);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-indigo-400">
          Your portfolio
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
          {data?.user?.name ?? "Learner"}&apos;s wall
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Everything you&apos;ve learned, built, and shipped — plus the badges
          that prove it.
        </p>
      </header>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          icon={<GraduationCap className="h-4 w-4" />}
          label="Lessons completed"
          value={`${totalCompleted}`}
        />
        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          label="Badges earned"
          value={`${unlocked.length} / ${achievements.length}`}
        />
        <StatCard
          icon={<Bot className="h-4 w-4" />}
          label="Agent friends"
          value={`${AGENTS.length}`}
        />
        <StatCard
          icon={<Flame className="h-4 w-4" />}
          label="Streak"
          value="1 day"
          accent
        />
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold text-white">Badges</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={
                "group relative overflow-hidden rounded-xl border p-4 text-center transition " +
                (a.unlocked
                  ? "border-indigo-500/40 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5"
                  : "border-zinc-800 bg-zinc-900/30 opacity-60")
              }
            >
              <div
                className={
                  "mx-auto flex h-12 w-12 items-center justify-center rounded-xl " +
                  (a.unlocked
                    ? "bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/20"
                    : "bg-zinc-800 text-zinc-500")
                }
              >
                {a.icon}
              </div>
              <p className="mt-3 text-xs font-semibold text-white">
                {a.title}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">{a.body}</p>
              {a.earnedFrom && a.unlocked && (
                <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-zinc-500">
                  awarded by{" "}
                  <span className="text-zinc-300">
                    {AGENTS.find((ag) => ag.id === a.earnedFrom)?.name}
                  </span>
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold text-white">
          Activity timeline
        </h2>
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
          {totalCompleted === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-zinc-400">
                No completions yet.{" "}
                <Link
                  href="/learn"
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  Start a lesson
                </Link>{" "}
                to fill this up.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800/60">
              {Object.entries(progress).flatMap(([programSlug, lessons]) =>
                Object.entries(lessons)
                  .sort((a, b) =>
                    (b[1].completedAt ?? "").localeCompare(
                      a[1].completedAt ?? "",
                    ),
                  )
                  .map(([lessonSlug, entry]) => (
                    <li
                      key={`${programSlug}:${lessonSlug}`}
                      className="flex items-center justify-between px-5 py-3"
                    >
                      <div>
                        <p className="text-sm text-white">
                          Completed <span className="text-indigo-300">{lessonSlug}</span>
                        </p>
                        <p className="text-xs text-zinc-500">
                          {new Date(entry.completedAt).toLocaleString()} ·{" "}
                          {programSlug}
                        </p>
                      </div>
                      <Link
                        href={`/learn/${programSlug}/${lessonSlug}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        Revisit →
                      </Link>
                    </li>
                  )),
              )}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-white">
          Agents you&apos;ve worked with
        </h2>
        <div className="flex flex-wrap gap-2">
          {AGENTS.map((a) => (
            <Link
              key={a.id}
              href={`/classroom/agents/${a.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-indigo-500/50"
            >
              <AgentAvatar agent={a} size="xs" showStatus />
              {a.name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-300">
          {icon}
        </span>
        {label}
      </div>
      <p
        className={
          "mt-2 text-2xl font-bold tracking-tight " +
          (accent ? "text-amber-300" : "text-white")
        }
      >
        {value}
      </p>
    </div>
  );
}
