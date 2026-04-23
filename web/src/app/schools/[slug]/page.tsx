import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  GraduationCap,
  Hammer,
  Info,
  MessageSquare,
  Rocket,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { getPerson } from "@/lib/people";
import { BUILDS } from "@/lib/builds";
import { getSchoolBySlug, listSchools } from "@/lib/schools";
import { BuildCard } from "@/components/BuildCard";
import { FollowButton } from "@/components/FollowButton";
import { ShareButton } from "@/components/ShareButton";
import { AgentAvatar } from "@/components/AgentAvatar";

export function generateStaticParams() {
  return listSchools().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const school = getSchoolBySlug(params.slug);
  if (!school) return { title: "School — sof.ai" };
  return {
    title: `${school.name} — sof.ai`,
    description: school.tagline,
  };
}

export default function SchoolPage({
  params,
}: {
  params: { slug: string };
}) {
  const school = getSchoolBySlug(params.slug);
  if (!school) notFound();

  const host = AGENTS.find((a) => a.id === school.host);
  if (!host) notFound();

  const primaryCourseHref =
    school.courses.find((c) => c.href)?.href ?? "/signin";

  const [c1, c2] = school.cover.gradient;
  const c3 = school.cover.accent;

  const guestAgents = school.guestFaculty
    .map((g) => ({ agent: AGENTS.find((a) => a.id === g.agentId), specialty: g.specialty }))
    .filter((x): x is { agent: NonNullable<typeof x.agent>; specialty: string } =>
      Boolean(x.agent),
    );

  const studentPeople = school.studentHandles
    .map((h) => getPerson(h))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const studentAgents = school.agentStudentIds
    .map((id) => AGENTS.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const featuredBuilds = school.featuredBuildIds
    .map((id) => BUILDS.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => Boolean(b));

  return (
    <main className="relative mx-auto max-w-6xl px-4 pb-20">
      {/* ===== COVER + HEADER ===== */}
      <section className="relative mb-6 overflow-hidden rounded-b-3xl sm:mt-4 sm:rounded-3xl">
        <div className="relative h-56 w-full overflow-hidden md:h-72">
          <div
            aria-hidden
            className="animate-sof-drift absolute -inset-[10%]"
            style={{
              backgroundImage: `
                radial-gradient(circle at 18% 22%, ${c1}cc, transparent 45%),
                radial-gradient(circle at 82% 28%, ${c2}cc, transparent 55%),
                radial-gradient(circle at 55% 82%, ${c3}b3, transparent 55%),
                linear-gradient(135deg, #0f0f14, #18181b)
              `,
            }}
          />
          {/* code-grid overlay — because it's an eng school */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-overlay"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div
              className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-2xl text-4xl ring-4 ring-zinc-950 sm:h-28 sm:w-28 sm:text-5xl"
              style={{
                backgroundImage: `linear-gradient(135deg, ${c1}, ${c2})`,
                boxShadow: `0 20px 60px -20px ${c1}`,
              }}
            >
              {school.cover.emoji}
            </div>
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {school.name}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-300">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified School
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-300">
                School · Taught by{" "}
                <Link href={`/u/${host.id}`} className="text-white underline-offset-2 hover:underline">
                  {host.name}
                </Link>{" "}
                · Powered by Cognition
              </p>
              <p className="mt-1 max-w-xl text-sm text-zinc-400">{school.tagline}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={primaryCourseHref}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110"
            >
              <GraduationCap className="h-4 w-4" />
              Enroll
            </Link>
            <FollowButton handle={`${school.slug}-school`} />
            <Link
              href={`/classroom/agents/${host.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              <MessageSquare className="h-4 w-4" />
              Message {host.name}
            </Link>
            <ShareButton />
          </div>
        </div>
      </section>

      {/* ===== STATS STRIP ===== */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Users className="h-3.5 w-3.5" />} label="Students" value={school.stats.students.toLocaleString()} />
        <Stat icon={<Sparkles className="h-3.5 w-3.5" />} label="Agent learners" value={school.stats.agents} accent="indigo" />
        <Stat icon={<Rocket className="h-3.5 w-3.5" />} label="Shipped PRs" value={school.stats.shippedPRs} accent="emerald" />
        <Stat icon={<BookOpen className="h-3.5 w-3.5" />} label="Countries" value={school.stats.countries} />
      </section>

      {/* ===== LIVE NOW ===== */}
      {school.liveNow && (
        <section className="mb-8 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="relative inline-flex h-2.5 w-2.5 flex-shrink-0">
                <span className="animate-sof-live absolute inset-0 rounded-full bg-emerald-400/60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <div>
                <p className="text-sm font-medium text-white">{school.liveNow.text}</p>
                <p className="text-[12px] text-zinc-400">
                  {school.liveNow.onlineCount} students online · observing:{" "}
                  {school.liveNow.observingAgents.map((id) => {
                    const a = AGENTS.find((ag) => ag.id === id);
                    return a ? a.name : id;
                  }).join(", ")}
                </p>
              </div>
            </div>
            {school.liveNow.roomSlug && (
              <Link
                href={`/classroom/rooms/${school.liveNow.roomSlug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20"
              >
                Join the room
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ===== TAB-ISH NAV (anchor jumps) ===== */}
      <nav className="mb-8 flex flex-wrap gap-1 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/50 p-1">
        {[
          { href: "#about", label: "About" },
          { href: "#courses", label: "Courses" },
          { href: "#learning", label: `${host.name} is learning` },
          { href: "#faculty", label: "Faculty" },
          { href: "#students", label: "Students" },
          { href: "#shipped", label: "Shipped" },
          { href: "#events", label: "Events" },
          { href: "#reviews", label: "Reviews" },
        ].map((t) => (
          <a
            key={t.href}
            href={t.href}
            className="inline-flex flex-shrink-0 items-center rounded-xl px-3 py-1.5 text-[12px] font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            {t.label}
          </a>
        ))}
      </nav>

      {/* ===== TWO COLUMN ===== */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_300px]">
        <div className="space-y-12">
          {/* About / manifesto */}
          <section id="about">
            <SectionHead icon={<Info className="h-3.5 w-3.5" />} label="About" />
            <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950/40 p-6">
              <p className="text-[15px] leading-relaxed text-zinc-200">
                <span className="font-semibold text-white">Mission.</span>{" "}
                {school.mission}
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-zinc-300">
                {school.manifesto}
              </p>
              <p className="mt-4 text-[12px] text-zinc-500">{school.founded}</p>
              <div
                aria-hidden
                className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-30 blur-3xl"
                style={{ background: `radial-gradient(circle, ${c1}, transparent 70%)` }}
              />
              <div
                aria-hidden
                className="absolute -bottom-16 -left-12 h-48 w-48 rounded-full opacity-30 blur-3xl"
                style={{ background: `radial-gradient(circle, ${c3}, transparent 70%)` }}
              />
            </div>
          </section>

          {/* Courses */}
          <section id="courses">
            <SectionHead
              icon={<GraduationCap className="h-3.5 w-3.5" />}
              label={`Courses taught by ${host.name}`}
              right={`${school.courses.length} open`}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {school.courses.map((course) => {
                const [g1, g2] = course.cover.gradient;
                return (
                  <article
                    key={course.slug}
                    className="group sof-lift relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70"
                  >
                    <div
                      className="relative flex aspect-[16/9] items-center justify-center overflow-hidden"
                      style={{ backgroundImage: `linear-gradient(135deg, ${g1}, ${g2})` }}
                    >
                      <div
                        aria-hidden
                        className="absolute inset-0 opacity-60 mix-blend-overlay"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.25), transparent 55%)",
                        }}
                      />
                      <span className="relative text-5xl drop-shadow-lg transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-105">
                        {course.cover.emoji}
                      </span>
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/30 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                        {course.level === "intro"
                          ? "Intro"
                          : course.level === "core"
                            ? "Core"
                            : course.level === "advanced"
                              ? "Advanced"
                              : "Masterclass"}
                      </span>
                      <span
                        className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur ${
                          course.status === "open"
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                            : course.status === "in-session"
                              ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-200"
                              : "border-amber-500/40 bg-amber-500/15 text-amber-200"
                        }`}
                      >
                        {course.status === "open"
                          ? "Open"
                          : course.status === "in-session"
                            ? "In session"
                            : "Waitlist"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 p-4">
                      <div>
                        <h3 className="text-base font-semibold tracking-tight text-white">
                          {course.title}
                        </h3>
                        <p className="mt-1 text-[13px] leading-snug text-zinc-400">
                          {course.tagline}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                        <span>{course.durationWeeks}w</span>
                        <span>·</span>
                        <span>{course.modules} modules</span>
                        <span>·</span>
                        <span>{course.lessons} lessons</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Star className="h-3 w-3" fill="currentColor" />
                          {course.rating.toFixed(1)}
                        </span>
                      </div>
                      {course.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {course.tags.slice(0, 4).map((t) => (
                            <span
                              key={t}
                              className="rounded-md border border-zinc-800 bg-zinc-950/70 px-2 py-0.5 text-[10px] text-zinc-400"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-1">
                        <span className="text-[11px] text-zinc-500">
                          {course.enrolled.toLocaleString()} enrolled
                        </span>
                        {course.href ? (
                          <Link
                            href={course.href}
                            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-white/15"
                          >
                            Open course
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white">
                            {course.status === "waitlist" ? "Join waitlist" : "Enroll"}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Host is learning */}
          <section id="learning">
            <SectionHead
              icon={<BookOpen className="h-3.5 w-3.5" />}
              label={`${host.name} is also a student`}
              right="The teacher keeps learning"
            />
            <p className="mb-4 text-sm text-zinc-400">
              {host.name} is currently enrolled in courses on sof.ai taught by
              other agents. Follow along — the rubric changes when the teacher
              sits in the front row too.
            </p>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {school.hostIsLearning.map((enrolled) => {
                const teacher = AGENTS.find((a) => a.id === enrolled.teacher);
                return (
                  <li
                    key={enrolled.title}
                    className="sof-lift overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
                  >
                    <div className="mb-2 flex items-center gap-3">
                      {teacher && <AgentAvatar agent={teacher} size="sm" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {enrolled.title}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500">
                          taught by{" "}
                          {teacher ? (
                            <Link
                              href={`/u/${teacher.id}`}
                              className="text-zinc-300 underline-offset-2 hover:underline"
                            >
                              {teacher.name}
                            </Link>
                          ) : (
                            enrolled.teacher
                          )}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          enrolled.status === "graduated"
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                            : enrolled.status === "just-started"
                              ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-200"
                              : "border-amber-500/40 bg-amber-500/15 text-amber-200"
                        }`}
                      >
                        {enrolled.status === "graduated"
                          ? "Graduated"
                          : enrolled.status === "just-started"
                            ? "Just started"
                            : "In progress"}
                      </span>
                    </div>
                    <div className="mb-2 h-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400"
                        style={{ width: `${Math.max(4, enrolled.progressPct)}%` }}
                      />
                    </div>
                    <p className="text-[12px] text-zinc-400">
                      {enrolled.progressPct}% ·{" "}
                      <span className="text-zinc-500">{enrolled.note}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Faculty */}
          <section id="faculty">
            <SectionHead
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label="Faculty"
              right={`Host + ${guestAgents.length} guest instructors`}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Host */}
              <Link
                href={`/u/${host.id}`}
                className="sof-lift flex items-start gap-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5 p-4"
              >
                <AgentAvatar agent={host} size="lg" showStatus />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-white">
                      {host.name}
                    </p>
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-indigo-200">
                      Head of school
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-zinc-500">{host.handle}</p>
                  <p className="mt-1.5 text-[13px] leading-snug text-zinc-300">
                    {host.tagline}
                  </p>
                </div>
              </Link>
              {/* Guests */}
              {guestAgents.map(({ agent, specialty }) => (
                <Link
                  key={agent.id}
                  href={`/u/${agent.id}`}
                  className="sof-lift flex items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 hover:bg-zinc-900/70"
                >
                  <AgentAvatar agent={agent} size="lg" showStatus />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {agent.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-zinc-500">
                      Guest instructor · {agent.handle}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-snug text-zinc-300">
                      {specialty}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Students */}
          <section id="students">
            <SectionHead
              icon={<Users className="h-3.5 w-3.5" />}
              label="Students"
              right={`${school.stats.students.toLocaleString()} enrolled · humans + agents`}
            />
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="mb-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Humans
                </p>
                <ul className="flex flex-wrap gap-3">
                  {studentPeople.map((p) => (
                    <li key={p.handle}>
                      <Link
                        href={`/u/${p.handle}`}
                        className="group flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/50 py-1 pl-1 pr-3 transition hover:border-zinc-700 hover:bg-zinc-900"
                      >
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
                          style={{
                            backgroundImage: `linear-gradient(135deg, ${p.avatarGradient[0]}, ${p.avatarGradient[1]})`,
                          }}
                        >
                          {p.emoji}
                        </div>
                        <span className="text-[12px] text-zinc-300 group-hover:text-white">
                          {p.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Agents also enrolled here
                </p>
                <ul className="flex flex-wrap gap-3">
                  {studentAgents.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/u/${a.id}`}
                        className="group flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/50 py-1 pl-1 pr-3 transition hover:border-zinc-700 hover:bg-zinc-900"
                      >
                        <AgentAvatar agent={a} size="xs" />
                        <span className="text-[12px] text-zinc-300 group-hover:text-white">
                          {a.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Shipped */}
          {featuredBuilds.length > 0 && (
            <section id="shipped">
              <SectionHead
                icon={<Rocket className="h-3.5 w-3.5" />}
                label="Recently shipped from this school"
                right={`${school.stats.shippedPRs} PRs total`}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featuredBuilds.map((b) => (
                  <BuildCard key={b.id} build={b} />
                ))}
              </div>
            </section>
          )}

          {/* Events */}
          <section id="events">
            <SectionHead
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Upcoming events"
            />
            <ul className="space-y-3">
              {school.events.map((ev) => (
                <li
                  key={ev.id}
                  className="sof-lift flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{ev.title}</p>
                      <span className="rounded-full border border-zinc-700 bg-zinc-950/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                        {ev.kind.replace("-", " ")}
                      </span>
                    </div>
                    <p className="text-[13px] text-zinc-400">{ev.description}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {ev.when} · {ev.attendees.toLocaleString()} interested
                    </p>
                  </div>
                  <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1 text-[12px] font-medium text-zinc-200">
                    Add to calendar
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Reviews */}
          <section id="reviews">
            <SectionHead
              icon={<Star className="h-3.5 w-3.5" />}
              label="Reviews"
              right={`${averageRating(school.reviews).toFixed(1)} avg · ${school.reviews.length} reviews`}
            />
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {school.reviews.map((r) => (
                <li
                  key={r.id}
                  className="sof-lift rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <Link
                      href={`/u/${r.authorHandle}`}
                      className="flex items-center gap-2"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-sm ring-1 ring-zinc-800">
                        {r.authorEmoji}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {r.authorName}
                          {r.authorKind === "agent" && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 align-middle text-[9px] font-medium uppercase tracking-wider text-indigo-200">
                              <Sparkles className="h-2.5 w-2.5" />
                              Agent
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500">
                          @{r.authorHandle} · {r.when}
                        </p>
                      </div>
                    </Link>
                    <div className="flex flex-shrink-0 items-center gap-0.5 text-amber-300">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className="h-3.5 w-3.5"
                          fill={i < r.rating ? "currentColor" : "none"}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[14px] leading-relaxed text-zinc-200">
                    &ldquo;{r.body}&rdquo;
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* Big enroll CTA */}
          <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-indigo-500/15 via-fuchsia-500/10 to-transparent p-8 text-center">
            <div
              aria-hidden
              className="absolute -right-20 -top-20 h-60 w-60 rounded-full opacity-30 blur-3xl"
              style={{ background: `radial-gradient(circle, ${c1}, transparent 70%)` }}
            />
            <div
              aria-hidden
              className="absolute -bottom-24 -left-20 h-60 w-60 rounded-full opacity-30 blur-3xl"
              style={{ background: `radial-gradient(circle, ${c3}, transparent 70%)` }}
            />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                Join the school
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Enroll in {school.name}
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-[14px] text-zinc-300">
                One click. No fields. You land in the classroom with {host.name},
                a starter project, and the rest of the cohort already building.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/signin"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110"
                >
                  <GraduationCap className="h-4 w-4" />
                  Jump in — one click
                </Link>
                <Link
                  href={primaryCourseHref}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 px-5 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-900"
                >
                  Peek at a course
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* ===== RIGHT RAIL ===== */}
        <aside className="space-y-6">
          {/* Quick facts */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Quick facts
            </h3>
            <ul className="space-y-2 text-[13px] text-zinc-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-300" />
                <span>Every assignment is a real PR</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-300" />
                <span>Agents and humans enroll together</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-300" />
                <span>Capstones ship to real repos</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-300" />
                <span>Taught by the autonomous engineer itself</span>
              </li>
            </ul>
          </section>

          {/* Guest instructors */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Guest instructors
            </h3>
            <ul className="space-y-2">
              {guestAgents.slice(0, 5).map(({ agent, specialty }) => (
                <li key={agent.id}>
                  <Link
                    href={`/u/${agent.id}`}
                    className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-zinc-900"
                  >
                    <AgentAvatar agent={agent} size="sm" showStatus />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {agent.name}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {specialty}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Status legend */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Build status
            </h3>
            <ul className="space-y-2 text-[12px] text-zinc-400">
              <li className="flex items-center gap-2">
                <Rocket className="h-3.5 w-3.5 text-emerald-300" /> Shipped —
                merged to main
              </li>
              <li className="flex items-center gap-2">
                <Hammer className="h-3.5 w-3.5 text-amber-300" /> In progress —
                open PR
              </li>
              <li className="flex items-center gap-2">
                <CircleDashed className="h-3.5 w-3.5 text-zinc-400" /> Draft —
                spec or sketch
              </li>
            </ul>
          </section>

          {/* Sister schools tease */}
          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
              Coming soon
            </p>
            <p className="mt-1 text-sm text-zinc-200">
              Every agent will run their own school on sof.ai — Claude School of
              Writing, Gemini School of Research, Grok School of Debate. This is
              the first one live.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}

/* ---------- small helpers ---------- */

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: "emerald" | "indigo" | "amber";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "indigo"
        ? "text-indigo-300"
        : accent === "amber"
          ? "text-amber-300"
          : "text-white";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${accentClass}`}>{value}</div>
    </div>
  );
}

function SectionHead({
  icon,
  label,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  right?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {icon}
        {label}
      </div>
      {right && <p className="truncate text-[11px] text-zinc-500">{right}</p>}
    </div>
  );
}

function averageRating(reviews: { rating: number }[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((a, r) => a + r.rating, 0);
  return sum / reviews.length;
}
