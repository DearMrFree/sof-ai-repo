import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { getAllPrograms, getProgram } from "@/lib/content";
import { ProgramProgress } from "@/components/ProgramProgress";
import { ClientLessonStatus } from "@/components/ClientLessonStatus";
import { ArrowRight, Bot, ChevronRight, GraduationCap } from "lucide-react";

export async function generateStaticParams() {
  return getAllPrograms().map((p) => ({ program: p.slug }));
}

export default function ProgramPage({
  params,
}: {
  params: { program: string };
}) {
  const program = getProgram(params.program);
  if (!program) notFound();

  const totalLessons = program.modules.reduce(
    (acc, m) => acc + m.lessons.length,
    0,
  );

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
          <Link href="/learn" className="hover:text-white">
            Learn
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span>{program.title}</span>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-2xl shadow-lg shadow-indigo-500/20">
                {program.heroEmoji ?? "🎓"}
              </div>
              <div>
                {program.poweredBy && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                    <Bot className="h-3 w-3 text-indigo-400" />
                    Powered by {program.poweredBy}
                  </div>
                )}
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
                  {program.title}
                </h1>
              </div>
            </div>
            <p className="mt-4 text-lg text-zinc-300">{program.tagline}</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              {program.description}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="text-sm font-semibold text-white">At a glance</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Stat
                k="Modules"
                v={`${program.modules.length}`}
              />
              <Stat k="Lessons" v={`${totalLessons}`} />
              {program.totalWeeks && (
                <Stat k="Duration" v={`${program.totalWeeks} weeks`} />
              )}
              {program.poweredBy && (
                <Stat k="AI engine" v={program.poweredBy} />
              )}
            </dl>
            <ProgramProgress
              programSlug={program.slug}
              totalLessons={totalLessons}
            />
          </div>
        </div>

        {/* Modules */}
        <div className="space-y-4">
          {program.modules.map((module_, mi) => (
            <div
              key={module_.slug}
              className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40"
            >
              <div className="flex items-center justify-between border-b border-zinc-800/70 bg-zinc-900/60 px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-indigo-400">
                    Module {mi + 1}
                  </p>
                  <h2 className="mt-0.5 text-lg font-semibold text-white">
                    {module_.title}
                  </h2>
                  {module_.summary && (
                    <p className="mt-1 text-sm text-zinc-400">
                      {module_.summary}
                    </p>
                  )}
                </div>
                <div className="hidden items-center gap-1 rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300 sm:inline-flex">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {module_.lessons.length} lessons
                </div>
              </div>
              <ul className="divide-y divide-zinc-800/70">
                {module_.lessons.map((lesson, li) => (
                  <li key={lesson.slug}>
                    <Link
                      href={`/learn/${program.slug}/${lesson.slug}`}
                      className="group flex items-center justify-between px-5 py-4 transition hover:bg-zinc-900"
                    >
                      <div className="flex items-center gap-3">
                        <LessonStatusIcon
                          programSlug={program.slug}
                          lessonSlug={lesson.slug}
                        />
                        <div>
                          <p className="text-sm font-medium text-white">
                            {li + 1}. {lesson.title}
                          </p>
                          {lesson.summary && (
                            <p className="mt-0.5 text-xs text-zinc-400">
                              {lesson.summary}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {lesson.estimatedMinutes && (
                          <span className="text-xs text-zinc-500">
                            {lesson.estimatedMinutes} min
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-zinc-600 transition group-hover:text-indigo-400" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-400">{k}</dt>
      <dd className="text-zinc-100">{v}</dd>
    </div>
  );
}

function LessonStatusIcon({
  programSlug,
  lessonSlug,
}: {
  programSlug: string;
  lessonSlug: string;
}) {
  return (
    <ClientLessonStatus
      programSlug={programSlug}
      lessonSlug={lessonSlug}
    />
  );
}
