import Link from "next/link";
import {
  Building2,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  ShieldCheck,
  Users,
} from "lucide-react";

/**
 * The six audience clusters the user wants the landing page to speak to
 * at once. Each lane has a one-liner pitch + a primary action that drops
 * the visitor into the right surface for that audience.
 *
 * IDs match ``UserType`` (forthcoming PR-ONBOARDING) so the same labels
 * can drive search filters on /u.
 */
type Lane = {
  id: string;
  audience: string;
  headline: string;
  body: string;
  cta: { label: string; href: string };
  icon: React.ReactNode;
  accent: { ring: string; tint: string; glow: string };
};

const LANES: Lane[] = [
  {
    id: "student",
    audience: "Students",
    headline: "Pass the class. Ship a portfolio.",
    body: "AI tutors that know exactly what you're stuck on. Capstones with Devin where you commit real PRs to real repos. Your transcript is the diff log.",
    cta: { label: "See the students", href: "/u?type=student" },
    icon: <GraduationCap className="h-5 w-5" />,
    accent: {
      ring: "border-indigo-500/40 hover:border-indigo-400",
      tint: "bg-indigo-500/10",
      glow: "shadow-indigo-500/20",
    },
  },
  {
    id: "educator",
    audience: "Educators",
    headline: "Teach with agents, not despite them.",
    body: "Build curriculum once; watch agents adapt it per learner. AI-graded assignments with transparent rubrics — you stay in the loop, agents handle the volume.",
    cta: { label: "Meet the educators", href: "/u?type=educator" },
    icon: <Lightbulb className="h-5 w-5" />,
    accent: {
      ring: "border-amber-500/40 hover:border-amber-400",
      tint: "bg-amber-500/10",
      glow: "shadow-amber-500/20",
    },
  },
  {
    id: "corporation",
    audience: "Corporations",
    headline: "Reskill teams in the language of agents.",
    body: "Cohort-based programs. Devin-paired engineering capstones. Embedded concierge agents on your customer surfaces (like LuxAI1 on ai1.llc) trained continuously by your operators.",
    cta: { label: "See live deployment", href: "/u?type=corporation" },
    icon: <Building2 className="h-5 w-5" />,
    accent: {
      ring: "border-emerald-500/40 hover:border-emerald-400",
      tint: "bg-emerald-500/10",
      glow: "shadow-emerald-500/20",
    },
  },
  {
    id: "administrator",
    audience: "Administrators",
    headline: "Real-time visibility. Real audit trails.",
    body: "Every conversation, every applied capability, every reviewer verdict — logged, queryable, defensible. The classifier flags anomalies before you have to.",
    cta: { label: "Open admin dashboard", href: "/u?type=administrator" },
    icon: <ShieldCheck className="h-5 w-5" />,
    accent: {
      ring: "border-rose-500/40 hover:border-rose-400",
      tint: "bg-rose-500/10",
      glow: "shadow-rose-500/20",
    },
  },
  {
    id: "researcher",
    audience: "Researchers",
    headline: "Open data on human–agent learning at scale.",
    body: "Every co-authored article, every review-chain verdict, every applied mentor note is a signal. We publish the substrate — bring your hypothesis.",
    cta: { label: "Find research peers", href: "/u?type=researcher" },
    icon: <FlaskConical className="h-5 w-5" />,
    accent: {
      ring: "border-cyan-500/40 hover:border-cyan-400",
      tint: "bg-cyan-500/10",
      glow: "shadow-cyan-500/20",
    },
  },
  {
    id: "founder",
    audience: "Founders",
    headline: "Spin up an agent. Train a business.",
    body: "Drop one script tag and your customers chat with an agent that learns from every conversation. Trainer co-work loop turns insights into shipped capabilities — no redeploy on your live site.",
    cta: { label: "Find founder peers", href: "/u?type=founder" },
    icon: <Users className="h-5 w-5" />,
    accent: {
      ring: "border-fuchsia-500/40 hover:border-fuchsia-400",
      tint: "bg-fuchsia-500/10",
      glow: "shadow-fuchsia-500/20",
    },
  },
];

export function AudienceLanes() {
  return (
    <section
      id="audiences"
      className="mx-auto max-w-6xl px-4 py-20"
      aria-labelledby="audiences-heading"
    >
      <div className="mb-10 text-center">
        <p className="text-xs uppercase tracking-wider text-indigo-400">
          Whoever you are, the door is open
        </p>
        <h2
          id="audiences-heading"
          className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl"
        >
          Six audiences. One school.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-400">
          sof.ai is built so a high-school student, a university dean, a
          corporate L&amp;D lead, a regulator, a researcher, and a founder
          all walk in the same door — and find a path that actually fits.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {LANES.map((lane, i) => {
          const external = lane.cta.href.startsWith("http");
          return (
            <article
              key={lane.id}
              data-audience={lane.id}
              className={`animate-sof-in group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 transition ${lane.accent.ring} hover:bg-zinc-900/70`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div
                className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg ${lane.accent.tint} ${lane.accent.glow}`}
              >
                {lane.icon}
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {lane.audience}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white">
                {lane.headline}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
                {lane.body}
              </p>
              <Link
                href={lane.cta.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-white transition group-hover:text-indigo-300"
              >
                {lane.cta.label} →
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
