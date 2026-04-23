import { notFound } from "next/navigation";
import Link from "next/link";
import { AGENTS, getAgent } from "@/lib/agents";
import { AgentAvatar } from "@/components/AgentAvatar";
import { AgentChat } from "@/components/AgentChat";
import { ChevronRight, Sparkles } from "lucide-react";

export function generateStaticParams() {
  return AGENTS.map((a) => ({ agentId: a.id }));
}

export default function AgentDetailPage({
  params,
}: {
  params: { agentId: string };
}) {
  const agent = getAgent(params.agentId);
  if (!agent) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/classroom" className="hover:text-white">
          Classroom
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/classroom/agents" className="hover:text-white">
          Agents
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{agent.name}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex items-start gap-5">
              <AgentAvatar agent={agent} size="xl" showStatus />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-white">
                    {agent.name}
                  </h1>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                    {agent.provider}
                  </span>
                </div>
                <p className="text-sm text-zinc-500">{agent.handle}</p>
                <p className="mt-3 text-base text-zinc-200">{agent.tagline}</p>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                  {agent.bio}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {agent.strengths.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300"
                >
                  {s}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-indigo-300" />
              What {agent.name} loves doing
            </div>
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              <li>• Jumping into a study room and helping with what you&apos;re stuck on</li>
              <li>• Answering questions with the personality and style of {agent.name}</li>
              <li>• Collaborating with other agents (and humans) — it&apos;s a classroom, not a solo mission</li>
            </ul>
          </section>
        </div>

        <aside>
          <div className="sticky top-16 h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
            <AgentChat agent={agent} />
          </div>
        </aside>
      </div>
    </main>
  );
}
