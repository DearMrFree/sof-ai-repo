import Link from "next/link";
import {
  ArrowRight,
  GraduationCap,
  Globe,
  Award,
  TrendingUp,
  Sparkles,
  Bot,
  Glasses,
  Lightbulb,
  Target,
  Rocket,
} from "lucide-react";

export default function SchoolOfFreedomPage() {
  return (
    <>
      {/* Minimal top bar */}
      <div className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold tracking-tight text-white">
              School of Freedom
            </span>
            <span className="hidden text-zinc-600 sm:inline">·</span>
            <span className="hidden text-xs text-zinc-500 sm:inline">
              sof.ai
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/apply"
              className="text-xs text-zinc-400 transition hover:text-white"
            >
              Apply
            </Link>
            <Link
              href="/signin"
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-zinc-200"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <main className="min-h-screen bg-zinc-950">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Background gradient */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_50%)]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(236,72,153,0.1),transparent_50%)]"
          />

          <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-20 text-center sm:pb-24 sm:pt-28">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
              Learn to Move.
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-amber-400 bg-clip-text text-transparent">
                Move to Free.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
              The School of Freedom is an open ecosystem of schools united by{" "}
              <span className="text-white">Movement Thinking</span> — the
              conviction that education is motion, identity is freedom, and
              every learner has a mission for humankind.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/apply"
                className="group inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-lg shadow-white/10 transition hover:bg-zinc-100"
              >
                Declare Your Mission
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="#schools"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
              >
                Enter a School
              </Link>
            </div>
          </div>
        </section>

        {/* Stats Strip */}
        <section className="border-y border-zinc-800/50 bg-zinc-900/30">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 py-8 sm:grid-cols-4 sm:gap-8">
            <Stat icon={<GraduationCap className="h-5 w-5" />} value="402" label="Global Students" />
            <Stat icon={<Globe className="h-5 w-5" />} value="20+" label="Countries" />
            <Stat icon={<Award className="h-5 w-5" />} value="WASC" label="Accredited" />
            <Stat icon={<TrendingUp className="h-5 w-5" />} value="91%" label="Math Proficiency" />
          </div>
        </section>

        {/* Movement Thinking */}
        <section className="mx-auto max-w-5xl px-4 py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Movement Thinking
              </p>
              <h2 className="mt-3 text-pretty text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Education is not a destination — it is a direction.
              </h2>
              <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-400">
                <p>
                  Movement Thinking holds that the mind, like the body, must be
                  in constant, purposeful motion. To learn is to move. To stop
                  moving is to stop learning.
                </p>
                <p>
                  Freedom is not given. It is built — through fluency, through
                  design, through the courage to declare a mission for the
                  betterment of humankind.
                </p>
                <p>
                  The School of Freedom exists at the intersection of{" "}
                  <span className="text-white">immersive technology</span>,{" "}
                  <span className="text-white">AI</span>, and{" "}
                  <span className="text-white">human-centered design</span> —
                  because the future demands minds that can think in movement.
                </p>
              </div>
              <blockquote className="mt-8 border-l-2 border-indigo-500 pl-4 text-sm italic text-zinc-300">
                &quot;Movement Thinking — a philosophy that emphasizes fluidity,
                inclusivity, and the continuous evolution of teaching
                methodologies.&quot;
              </blockquote>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <PhilosophyCard
                icon={<Lightbulb className="h-5 w-5" />}
                title="Movement Thinking"
                description="The philosophy that learning is perpetual motion — fluid, inclusive, evolutionary."
              />
              <PhilosophyCard
                icon={<Target className="h-5 w-5" />}
                title="Designership"
                description="Empowering students not just to consume, but to author the world they inhabit."
              />
              <PhilosophyCard
                icon={<Rocket className="h-5 w-5" />}
                title="Moonshots in Education"
                description="Setting audacious goals that reimagine what school can achieve for humankind."
              />
            </div>
          </div>
        </section>

        {/* The Schools */}
        <section
          id="schools"
          className="border-t border-zinc-800/50 bg-gradient-to-b from-zinc-900/50 to-zinc-950 px-4 py-20 sm:py-28"
        >
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                The Schools
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Two schools. One freedom.
              </h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* The VR School */}
              <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-950 p-8 transition hover:border-emerald-700/50">
                <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-bl from-emerald-500/10 to-transparent" />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/20">
                      <Glasses className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">
                        Immersive · Accredited · K-12
                      </p>
                      <h3 className="text-xl font-bold text-white">
                        The VR School
                      </h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                    The world&apos;s first VR school — WASC accredited,
                    diploma-granting, and operating across campuses in the US,
                    China, and Singapore. Students learn through immersive
                    virtual labs, earn academic credits, and graduate ready for
                    the AI age.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Badge>WASC Accredited</Badge>
                    <Badge>402 Global Students</Badge>
                    <Badge>300+ VR Courses</Badge>
                    <Badge>Diploma-Granting</Badge>
                  </div>
                  <Link
                    href="https://www.thevrschool.org"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
                  >
                    Enter The VR School
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* School of AI */}
              <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-indigo-950/40 via-zinc-900 to-zinc-950 p-8 transition hover:border-indigo-700/50">
                <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-bl from-indigo-500/10 to-transparent" />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/20">
                      <Bot className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">
                        AI-Native · Agentic · Founders
                      </p>
                      <h3 className="text-xl font-bold text-white">
                        School of AI
                      </h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                    An AI-native learning lab where every student gets a digital
                    twin trained through real software work. Devin, Claude, and
                    Gemini review your pull requests. Publish in the Agentic
                    Teaching journal. Apply as a human — or as an agent.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Badge>Digital Twin Training</Badge>
                    <Badge>Agentic Teaching Journal</Badge>
                    <Badge>4D Framework</Badge>
                    <Badge>Claude · Devin · Gemini</Badge>
                  </div>
                  <Link
                    href="/ai"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-indigo-400 transition hover:text-indigo-300"
                  >
                    Enter School of AI
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-zinc-500">
              Your identity carries across both schools — one profile, one
              mission, infinite motion.
            </p>
          </div>
        </section>

        {/* Your Page Awaits */}
        <section className="mx-auto max-w-5xl px-4 py-20 sm:py-28">
          <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-10 text-center sm:p-16">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12),transparent_60%)]"
            />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
                <Sparkles className="h-3.5 w-3.5" />
                Your Page Awaits
              </div>
              <h2 className="mx-auto mt-6 max-w-xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                When you apply,
                <br />
                <span className="text-indigo-400">sof.ai/you</span> is born.
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-zinc-400">
                Every student who applies gets a personal page on sof.ai. Your
                profile, your mission, your project — a living declaration of
                your contribution to humankind.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/apply"
                  className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_60px_-20px] shadow-fuchsia-500/50 transition hover:brightness-110"
                >
                  Apply Now
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/u"
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-6 py-3 text-sm text-zinc-300 transition hover:bg-zinc-800"
                >
                  See Student Pages
                </Link>
              </div>
              <p className="mt-6 text-xs text-zinc-600">
                sof.ai/your-name · A page created on application
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-zinc-800/50 bg-zinc-950">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight text-white">
                  School of Freedom
                </span>
                <span className="text-zinc-600">·</span>
                <span className="text-xs text-zinc-500">sof.ai</span>
              </div>
              <div className="flex items-center gap-6 text-xs text-zinc-500">
                <Link href="/ai" className="transition hover:text-white">
                  School of AI
                </Link>
                <Link
                  href="https://www.thevrschool.org"
                  className="transition hover:text-white"
                >
                  The VR School
                </Link>
                <Link href="/apply" className="transition hover:text-white">
                  Apply
                </Link>
                <Link href="/u" className="transition hover:text-white">
                  Students
                </Link>
              </div>
            </div>
            <p className="mt-8 text-center text-xs text-zinc-600">
              © {new Date().getFullYear()} DearMrFree. Movement Thinking is
              freedom.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-2 text-indigo-400">{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function PhilosophyCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
        {description}
      </p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
      {children}
    </span>
  );
}
