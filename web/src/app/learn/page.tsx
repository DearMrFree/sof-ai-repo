import Link from "next/link";
import { Nav } from "@/components/Nav";
import { getAllPrograms } from "@/lib/content";
import { ProgramCard } from "@/components/ProgramCard";

export default function LearnDashboardPage() {
  const programs = getAllPrograms();

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-indigo-400">
            Your dashboard
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Continue learning
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Pick up where you left off, or start a new program.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {programs.map((program) => {
            const totalLessons = program.modules.reduce(
              (acc, m) => acc + m.lessons.length,
              0,
            );
            return (
              <ProgramCard
                key={program.slug}
                slug={program.slug}
                title={program.title}
                tagline={program.tagline}
                heroEmoji={program.heroEmoji}
                poweredBy={program.poweredBy}
                totalModules={program.modules.length}
                totalLessons={totalLessons}
                totalWeeks={program.totalWeeks}
              />
            );
          })}

          {programs.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
              No programs available yet.{" "}
              <Link href="/" className="text-indigo-400 underline">
                Back home
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
