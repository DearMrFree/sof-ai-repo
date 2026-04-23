import Link from "next/link";
import { Nav } from "@/components/Nav";
import { getAllPrograms } from "@/lib/content";
import { ArrowRight, Brain, Code2, Rocket, Sparkles, Bot, GraduationCap } from "lucide-react";

export default function HomePage() {
  const programs = getAllPrograms();

  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_60%)]" />
          <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              The most AI-enabled LMS on the planet
            </div>
            <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl">
              Learn anything.
              <br />
              Train anything.
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-rose-400 bg-clip-text text-transparent">
                Build anything.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
              sof.ai is the School of AI. Every lesson has an AI tutor. Every
              assessment is AI-graded. And our flagship <strong className="text-white">Software Engineer</strong> program is fully powered by Devin — you don&apos;t just read about engineering, you ship PRs with a real autonomous engineer.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/learn"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400"
              >
                Start learning
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#programs"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-3 text-sm text-zinc-300 transition hover:bg-zinc-800"
              >
                Browse programs
              </a>
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Pillar
              icon={<Brain className="h-5 w-5" />}
              title="Learn anything"
              body="An AI tutor in every lesson that knows exactly what you're stuck on. Personalized pacing. Adaptive quizzes that grow with you."
            />
            <Pillar
              icon={<Code2 className="h-5 w-5" />}
              title="Train anything"
              body="In-browser code sandboxes, notebooks, and simulators. Practice the thing you just read — without leaving the page."
            />
            <Pillar
              icon={<Rocket className="h-5 w-5" />}
              title="Build anything"
              body="Capstones where you pair with Devin — a real autonomous engineer — to ship real software. PRs, reviews, deploys."
            />
          </div>
        </section>

        {/* Programs */}
        <section id="programs" className="mx-auto max-w-6xl px-4 pb-24">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">
                Programs
              </h2>
              <p className="mt-1 text-zinc-400">
                Start with our Devin-powered Software Engineer track. More on the way.
              </p>
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

        <footer className="border-t border-zinc-900 py-10 text-center text-xs text-zinc-500">
          sof.ai — School of AI · Inspired by{" "}
          <a
            href="https://www.curriki.org"
            className="text-zinc-400 underline"
            target="_blank"
            rel="noreferrer"
          >
            Curriki
          </a>
          . Powered by{" "}
          <a
            href="https://devin.ai"
            className="text-zinc-400 underline"
            target="_blank"
            rel="noreferrer"
          >
            Devin
          </a>
          .
        </footer>
      </main>
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
