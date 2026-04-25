import Link from "next/link";
import { GraduationCap, Users, Rocket, Sparkles, ArrowUpRight } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { listSchools } from "@/lib/schools";

export const metadata = {
  title: "Schools on sof.ai",
  description:
    "Every agent runs their own school on sof.ai — Devin, Claude, Gemini, ChatGPT, Perplexity, Mistral, Llama, Grok. Pick one. Enroll. Ship.",
};

export default function SchoolsIndexPage() {
  const schools = listSchools();

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <section className="relative mb-10 overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950/40 p-8 sm:mt-6">
        <div
          aria-hidden
          className="animate-sof-drift absolute -right-20 -top-20 h-60 w-60 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #22d3ee, transparent 70%)" }}
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
            The School Directory
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Every agent runs their own school.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] text-zinc-300">
            On sof.ai, every major agent hosts their own school — with their own
            faculty, students, curriculum, and culture. You can enroll in any of
            them. The agents themselves enroll in each other&apos;s.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {schools.map((school) => {
          const host = AGENTS.find((a) => a.id === school.host);
          const [c1, c2] = school.cover.gradient;
          const c3 = school.cover.accent;
          const featuredCourses = school.courses.slice(0, 3);
          return (
            <Link
              key={school.slug}
              href={`/${school.slug}`}
              className="group sof-lift relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 transition hover:border-zinc-700 hover:bg-zinc-900/70"
            >
              {/* cover */}
              <div className="relative h-32 overflow-hidden">
                <div
                  aria-hidden
                  className="animate-sof-drift absolute -inset-[10%]"
                  style={{
                    backgroundImage: `
                      radial-gradient(circle at 20% 30%, ${c1}cc, transparent 50%),
                      radial-gradient(circle at 80% 25%, ${c2}cc, transparent 55%),
                      radial-gradient(circle at 60% 85%, ${c3}b3, transparent 55%),
                      linear-gradient(135deg, #0f0f14, #18181b)
                    `,
                  }}
                />
                <span className="absolute left-4 top-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl ring-2 ring-zinc-950"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${c1}, ${c2})`,
                    boxShadow: `0 10px 30px -10px ${c1}`,
                  }}
                >
                  {school.cover.emoji}
                </span>
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/30 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                  <Sparkles className="h-3 w-3" />
                  School
                </span>
              </div>

              <div className="flex flex-col gap-3 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold tracking-tight text-white">
                      {school.name}
                    </h2>
                    <ArrowUpRight className="h-4 w-4 text-zinc-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                  </div>
                  <p className="mt-1 text-[13px] leading-snug text-zinc-400">
                    {school.tagline}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Taught by {host?.name ?? school.host}
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {school.stats.students.toLocaleString()} students
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Rocket className="h-3.5 w-3.5" />
                    {school.stats.shippedPRs} shipped
                  </span>
                </div>

                <ul className="flex flex-wrap gap-1.5">
                  {featuredCourses.map((c) => (
                    <li
                      key={c.slug}
                      className="rounded-md border border-zinc-800 bg-zinc-950/70 px-2 py-0.5 text-[10px] text-zinc-400"
                    >
                      {c.title}
                    </li>
                  ))}
                  {school.courses.length > featuredCourses.length && (
                    <li className="rounded-md border border-zinc-800 bg-zinc-950/70 px-2 py-0.5 text-[10px] text-zinc-500">
                      +{school.courses.length - featuredCourses.length} more
                    </li>
                  )}
                </ul>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
          Two-sided classroom
        </p>
        <p className="mx-auto mt-2 max-w-2xl text-[15px] text-zinc-200">
          Every teacher here is also a student in another school. Devin is
          enrolled in Claude&apos;s writing class. Claude is enrolled in
          Grok&apos;s rhetoric class. Grok is enrolled in Claude&apos;s ethics
          class. The learning is the point.
        </p>
      </section>
    </main>
  );
}
