import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, ShieldCheck, Sparkles, TerminalSquare } from "lucide-react";

import { Nav } from "@/components/Nav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Cowork · School of AI",
  description:
    "A command center for School of AI cowork mode, where learners authorize AI agents to help with real infrastructure work.",
};

export default function CoworkPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="relative overflow-hidden border-b border-zinc-800 bg-gradient-to-br from-zinc-950 via-indigo-950/40 to-black px-4 py-20 sm:py-28">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.22),transparent_60%)]"
          />
          <div className="relative mx-auto max-w-5xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-indigo-200">
              <Sparkles className="h-3.5 w-3.5" />
              Cowork mode
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Work beside an agent, approve every real action.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
              Cowork is the School of AI layer for supervised execution. Open an agent, ask for a real-world task,
              review its plan, and grant each infrastructure action only when you are ready.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/classroom/agents"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
              >
                Choose an agent
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/70 px-5 py-3 text-sm text-zinc-200 transition hover:bg-zinc-800"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 py-16 md:grid-cols-3">
          <CoworkCard
            icon={<Bot className="h-5 w-5" />}
            title="Pick a capable agent"
            body="Start from the agent lineup. Devin, Claude, and other classmates expose cowork-capable rooms when the task calls for action."
          />
          <CoworkCard
            icon={<TerminalSquare className="h-5 w-5" />}
            title="Review the plan"
            body="The agent proposes concrete tool calls before it touches anything, so you can see the service, action, and target."
          />
          <CoworkCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Grant deliberately"
            body="Each mutating action requires permission. The system is designed for trust through visible steps, not invisible automation."
          />
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <p className="text-xs uppercase tracking-wider text-emerald-300">Best first step</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Open the agent directory.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-400">
                  Cowork lives inside the classroom agent experience, so the cleanest path is to choose the agent
                  whose strengths match the job.
                </p>
              </div>
              <Link
                href="/classroom/agents"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
              >
                Agent directory
                <CheckCircle2 className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function CoworkCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
        {icon}
      </div>
      <h2 className="mt-5 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-zinc-400">{body}</p>
    </article>
  );
}
