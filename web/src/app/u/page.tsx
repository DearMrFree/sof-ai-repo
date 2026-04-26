import Link from "next/link";
import { GraduationCap, Sparkles } from "lucide-react";
import { listPeople } from "@/lib/people";
import { AGENTS, listStudentAgents } from "@/lib/agents";
import { buildsFor, countByStatus } from "@/lib/builds";

export const metadata = {
  title: "People on sof.ai",
  description:
    "Every profile on sof.ai is an App Store of what the person has built. Browse learners, mentors, and agents.",
};

export default function PeopleDirectoryPage() {
  const people = listPeople();
  const studentAgents = listStudentAgents();
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
          and agents. Pick a learner or an agent to explore.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          People
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => {
            const builds = buildsFor(p.handle);
            const counts = countByStatus(builds);
            return (
              <Link
                key={p.handle}
                href={`/u/${p.handle}`}
                className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 transition hover:border-indigo-500/40 hover:bg-zinc-900/70"
              >
                <div
                  className="h-20"
                  style={{
                    backgroundImage: `radial-gradient(circle at 20% 30%, ${p.avatarGradient[0]}cc, transparent 55%), radial-gradient(circle at 80% 60%, ${p.avatarGradient[1]}cc, transparent 55%), radial-gradient(circle at 50% 100%, ${p.accentThird}b0, transparent 60%), #0f0f14`,
                  }}
                />
                <div className="flex items-start gap-3 p-4">
                  <div
                    className="-mt-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-2xl ring-4 ring-zinc-950"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${p.avatarGradient[0]}, ${p.avatarGradient[1]})`,
                    }}
                  >
                    {p.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{p.name}</p>
                    <p className="truncate text-[11px] text-zinc-500">@{p.handle}</p>
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
                      {p.tagline}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-500">
                      <span className="text-emerald-400">
                        {counts.shipped} shipped
                      </span>
                      <span className="text-amber-300">
                        {counts["in-progress"]} WIP
                      </span>
                      <span>{p.xp.toLocaleString()} XP</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {studentAgents.length > 0 ? (
        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            <GraduationCap className="h-3.5 w-3.5 text-emerald-300" />
            Student agents
          </h2>
          <p className="mb-4 max-w-2xl text-xs text-zinc-500">
            Agents enrolled at sof.ai under a human trainer. Each one is
            trained continuously by its owner via the trainer co-work loop —
            new capabilities ship live to its embed host within minutes, no
            redeploy.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {studentAgents.map((s) => (
              <Link
                key={s.id}
                href={`/u/${s.id}`}
                className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 transition hover:border-emerald-500/40 hover:bg-zinc-900/70"
              >
                <div
                  className="h-20"
                  style={{
                    backgroundImage: `radial-gradient(circle at 25% 25%, ${s.avatarGradient[0]}cc, transparent 55%), radial-gradient(circle at 75% 70%, ${s.avatarGradient[1]}cc, transparent 55%), #0f0f14`,
                  }}
                />
                <div className="flex items-start gap-3 p-4">
                  <div
                    className="-mt-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-2xl ring-4 ring-zinc-950"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${s.avatarGradient[0]}, ${s.avatarGradient[1]})`,
                    }}
                  >
                    {s.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">
                      {s.name}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {s.handle} · trained by{" "}
                      <span className="text-zinc-300">@{s.ownerHandle}</span>
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
                      {s.tagline}
                    </p>
                    {s.embedHost ? (
                      <p className="mt-3 text-[10px] text-emerald-400">
                        Live at {s.embedHost}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
          Agent profiles
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {AGENTS.map((a) => (
            <Link
              key={a.id}
              href={`/u/${a.id}`}
              className="group flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-center transition hover:border-indigo-500/40 hover:bg-zinc-900/70"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-xl shadow-lg"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${a.avatarGradient[0]}, ${a.avatarGradient[1]})`,
                  boxShadow: `0 8px 20px -8px ${a.avatarGradient[0]}`,
                }}
              >
                {a.emoji}
              </div>
              <p className="text-xs font-semibold text-white">{a.name}</p>
              <p className="text-[10px] text-zinc-500">{a.handle}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
