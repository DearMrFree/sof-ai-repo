import Link from "next/link";
import { flattenLessons, getAllPrograms } from "@/lib/content";
import { AGENTS, getAgent } from "@/lib/agents";
import { AgentAvatar } from "@/components/AgentAvatar";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Hourglass,
  Sparkles,
} from "lucide-react";

interface Assignment {
  id: string;
  programSlug: string;
  programTitle: string;
  moduleTitle: string;
  lessonSlug: string;
  lessonTitle: string;
  title: string;
  type: "devin_capstone" | "reflection" | "quiz";
  graderAgentId: string;
  rubric: string[];
  status: "not_started" | "in_progress" | "submitted" | "graded";
  score?: number;
  due?: string;
}

function buildAssignments(): Assignment[] {
  const out: Assignment[] = [];
  for (const program of getAllPrograms()) {
    for (const { module, lesson } of flattenLessons(program)) {
      if (lesson.devinCapstone) {
        out.push({
          id: `${program.slug}:${lesson.slug}:capstone`,
          programSlug: program.slug,
          programTitle: program.title,
          moduleTitle: module.title,
          lessonSlug: lesson.slug,
          lessonTitle: lesson.title,
          title: lesson.devinCapstone.title,
          type: "devin_capstone",
          graderAgentId: "claude",
          rubric: lesson.devinCapstone.rubric ?? [],
          status: "not_started",
        });
      }
    }
  }
  // Simulate some progress for the demo.
  if (out[0]) {
    out[0].status = "graded";
    out[0].score = 92;
  }
  if (out[1]) {
    out[1].status = "in_progress";
  }
  return out;
}

export default function AssignmentsPage() {
  const assignments = buildAssignments();
  const graded = assignments.filter((a) => a.status === "graded");
  const avgScore =
    graded.length > 0
      ? Math.round(graded.reduce((acc, a) => acc + (a.score ?? 0), 0) / graded.length)
      : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-indigo-400">
            Gradebook
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Assignments
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            Real work, AI-graded. Every Devin capstone is a real PR opened by a
            real autonomous engineer — we grade the PR + your review + your
            iterations, not just a quiz score.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-3">
          <Stat label="Total" value={`${assignments.length}`} />
          <Stat
            label="Completed"
            value={`${assignments.filter((a) => a.status === "graded").length}`}
          />
          <Stat
            label="Avg score"
            value={graded.length > 0 ? `${avgScore}%` : "—"}
            accent
          />
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-3 font-medium">Assignment</th>
              <th className="px-5 py-3 font-medium">Program</th>
              <th className="px-5 py-3 font-medium">Graded by</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Score</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {assignments.map((a) => {
              const grader = getAgent(a.graderAgentId);
              return (
                <tr key={a.id} className="hover:bg-zinc-900/40">
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {a.title}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {a.lessonTitle} · {a.moduleTitle}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-zinc-400">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-2 py-1">
                      <GraduationCap className="h-3 w-3 text-indigo-400" />
                      {a.programTitle.split(",")[0]}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {grader ? (
                      <div className="flex items-center gap-2">
                        <AgentAvatar agent={grader} size="xs" />
                        <span className="text-xs text-zinc-300">
                          {grader.name}
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-5 py-4">
                    {a.score !== undefined ? (
                      <span className="font-mono text-sm font-semibold text-emerald-300">
                        {a.score}%
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/learn/${a.programSlug}/${a.lessonSlug}`}
                      className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20"
                    >
                      Open
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {assignments.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-sm text-zinc-500"
                >
                  No assignments yet. Enroll in a program to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <GraderCard
          title="AI-graded, with rubrics"
          body="Every assignment carries a transparent rubric. The graders (Claude, by default) score against the rubric and return per-criterion feedback."
          icon={<Sparkles className="h-4 w-4" />}
        />
        <GraderCard
          title="Real work, not trivia"
          body="Devin capstones are actual PRs to real repos. You can't memorize your way to a good score — you have to ship and review."
          icon={<Bot className="h-4 w-4" />}
        />
        <GraderCard
          title="Human instructors optional"
          body="Teachers can override any AI grade. Peer review is built-in. A student reviewing a peer's PR gets XP, too."
          icon={<ClipboardList className="h-4 w-4" />}
        />
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <p className="text-sm font-semibold text-white">
          Grader agents in this cohort
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {AGENTS.filter((a) => a.online).map((a) => (
            <Link
              key={a.id}
              href={`/classroom/agents/${a.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-xs text-zinc-200 transition hover:border-indigo-500/50"
            >
              <AgentAvatar agent={a} size="xs" />
              {a.name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={
          "mt-1 text-xl font-bold tracking-tight " +
          (accent ? "text-emerald-300" : "text-white")
        }
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: Assignment["status"] }) {
  switch (status) {
    case "graded":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          Graded
        </span>
      );
    case "submitted":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
          <Hourglass className="h-3 w-3" />
          Grading
        </span>
      );
    case "in_progress":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
          <Hourglass className="h-3 w-3 animate-pulse" />
          In progress
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
          Not started
        </span>
      );
  }
}

function GraderCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
        {icon}
      </div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}
