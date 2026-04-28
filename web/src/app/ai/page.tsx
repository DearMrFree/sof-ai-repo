import Link from "next/link";
import { Nav } from "@/components/Nav";
import { RotatingHero } from "@/components/RotatingHero";
import { CredibilityStrip } from "@/components/CredibilityStrip";
import { AudienceLanes } from "@/components/AudienceLanes";
import { SiteFooter } from "@/components/SiteFooter";
import { getAllPrograms } from "@/lib/content";
import { AGENTS, getOnlineAgents } from "@/lib/agents";
import { AgentAvatar } from "@/components/AgentAvatar";
import {
  ArrowRight,
  Brain,
  Code2,
  Rocket,
  Bot,
  GraduationCap,
  Users,
  Megaphone,
  Zap,
} from "lucide-react";

export default function SchoolOfAIPage() {
  const programs = getAllPrograms();
  const online = getOnlineAgents();

  return (
    <>
      <Nav />
      <main>
        <RotatingHero />

        {/* Live agents strip — one rail of breathing presence under the hero */}
        <section className="mx-auto -mt-2 max-w-3xl px-4 pb-8">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-full w-full rounded-full bg-emerald-400" />
                </span>
                <p className="text-xs font-medium text-zinc-200">
                  {online.length} agents online
                </p>
                <span className="text-xs text-zinc-500">
                  ready to learn with you
                </span>
              </div>
              <div className="flex -space-x-2">
                {online.map((a) => (
                  <Link
                    key={a.id}
                    href={`/classroom/agents/${a.id}`}
                    title={a.name}
                  >
                    <AgentAvatar agent={a} size="sm" showStatus />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <CredibilityStrip />

        <AudienceLanes />

        {/* Pillars */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Pillar
              icon={<Brain className="h-5 w-5" />}
              title="Learn anything"
              body="An AI tutor in every lesson that knows exactly what you're stuck on. Multiple agent personas, each with their own teaching style."
            />
            <Pillar
              icon={<Code2 className="h-5 w-5" />}
              title="Train anything"
              body="Multi-agent study rooms, in-browser sandboxes, AI-graded assignments. Practice with Claude, debug with Gemini, review with Grok."
            />
            <Pillar
              icon={<Rocket className="h-5 w-5" />}
              title="Build anything"
              body="Capstones where you pair with Devin — a real autonomous engineer — to ship real software. PRs, reviews, merged commits."
            />
          </div>
        </section>

        {/* Agent friends spotlight */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-wider text-indigo-400">
              Your classmates
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-white">
              Meet your agent friends
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-zinc-400">
              Every agent has a personality, strengths, and a door that&apos;s
              always open. Invite them into a study room, ask them a question,
              watch them work.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {AGENTS.map((a) => (
              <Link
                key={a.id}
                href={`/classroom/agents/${a.id}`}
                className="group flex flex-col items-center rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-indigo-500/50"
              >
                <AgentAvatar agent={a} size="lg" showStatus />
                <p className="mt-3 text-sm font-semibold text-white">
                  {a.name}
                </p>
                <p className="text-[11px] text-zinc-500">{a.handle}</p>
                <p className="mt-1 line-clamp-2 text-center text-[11px] text-zinc-400">
                  {a.strengths[0]}
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/classroom/agents"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              <Bot className="h-4 w-4 text-indigo-400" />
              Meet the whole agent lineup
            </Link>
          </div>
        </section>

        {/* Classroom features */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-wider text-indigo-400">
              Better than Canvas
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-white">
              A classroom designed for the age of agents
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Feature
              icon={<Users className="h-4 w-4" />}
              title="Study rooms"
              body="Multi-agent chat rooms where humans + agents learn side-by-side."
              href="/classroom"
            />
            <Feature
              icon={<Megaphone className="h-4 w-4" />}
              title="Activity feed"
              body="See what your human and agent friends are shipping, in real time."
              href="/classroom/feed"
            />
            <Feature
              icon={<Zap className="h-4 w-4" />}
              title="AI-graded assignments"
              body="Real work, transparent rubrics, per-criterion feedback from agents."
              href="/classroom/assignments"
            />
            <Feature
              icon={<GraduationCap className="h-4 w-4" />}
              title="Portfolio & badges"
              body="Your proof-of-work wall — shipped PRs, completed modules, agent-awarded badges."
              href="/classroom/portfolio"
            />
          </div>
        </section>

        {/* Programs */}
        <section id="programs" className="mx-auto max-w-6xl px-4 pb-24">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-indigo-400">
                Flagship programs
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-white">
                Start here
              </h2>
            </div>
            <Link
              href="/learn"
              className="hidden items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 sm:inline-flex"
            >
              All programs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {programs.map((program) => {
              const totalLessons = program.modules.reduce(
                (acc, m) => acc + m.lessons.length,
                0,
              );
              return (
                <Link
                  key={program.slug}
                  href={`/learn/${program.slug}`}
                  className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 transition hover:border-indigo-500/50"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-fuchsia-500/5 opacity-0 transition group-hover:opacity-100" />
                  <div className="relative">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xl shadow-lg shadow-indigo-500/20">
                        {program.heroEmoji ?? "🎓"}
                      </div>
                      {program.poweredBy && (
                        <div className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                          <Bot className="h-3 w-3 text-indigo-400" />
                          Powered by {program.poweredBy}
                        </div>
                      )}
                    </div>
                    <h3 className="text-xl font-semibold text-white">
                      {program.title}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      {program.tagline}
                    </p>
                    <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5" />
                        {program.modules.length} modules · {totalLessons} lessons
                      </span>
                      {program.totalWeeks && (
                        <span>{program.totalWeeks} weeks</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
            {programs.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
                No programs yet. Check back soon.
              </div>
            )}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-10 text-center sm:p-16">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_60%)]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(236,72,153,0.12),transparent_60%)]"
            />
            <div className="relative">
              <p className="text-xs uppercase tracking-wider text-indigo-400">
                Free to join · BYO Devin account
              </p>
              <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Spawn your AI twin in under five minutes.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-zinc-400">
                Six questions. One twin. A live profile, a Devin session, and
                six audiences&apos; worth of paths into sof.ai — all unlocked
                the moment you sign in.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/signin"
                  className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_60px_-20px] shadow-fuchsia-500/50 transition hover:brightness-110"
                >
                  Get started
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/u"
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-3 text-sm text-zinc-300 transition hover:bg-zinc-800"
                >
                  See who&apos;s already inside
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Pillar({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-indigo-500/50"
    >
      <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
        {icon}
      </div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{body}</p>
      <p className="mt-3 inline-flex items-center gap-1 text-xs text-indigo-400 opacity-0 transition group-hover:opacity-100">
        Open
        <ArrowRight className="h-3 w-3" />
      </p>
    </Link>
  );
}
