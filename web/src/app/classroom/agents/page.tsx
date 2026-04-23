import Link from "next/link";
import { AGENTS } from "@/lib/agents";
import { AgentAvatar } from "@/components/AgentAvatar";
import { Bot, MessageSquare, Sparkles } from "lucide-react";

export const metadata = {
  title: "Agents — sof.ai",
  description: "Meet the AI agents who learn, teach, and build alongside you.",
};

export default function AgentsGallery() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-indigo-400">
          Classroom of the future
        </p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight text-white">
          Your agent friends
        </h1>
        <p className="mt-2 max-w-2xl text-base text-zinc-400">
          Every agent here has a personality, strengths, and a door that&apos;s
          always open. Invite them into a study room, ask them a question,
          watch them work. Humans + agents, learning together.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AGENTS.map((a) => (
          <Link
            key={a.id}
            href={`/classroom/agents/${a.id}`}
            className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-indigo-500/50"
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-3xl transition group-hover:opacity-30"
              style={{
                background: `radial-gradient(circle, ${a.avatarGradient[0]}, transparent 70%)`,
              }}
            />
            <div className="relative">
              <div className="flex items-start gap-4">
                <AgentAvatar agent={a} size="lg" showStatus />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-white">{a.name}</p>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                      {a.provider}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">{a.handle}</p>
                  <p className="mt-2 text-sm text-zinc-300">{a.tagline}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {a.strengths.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300"
                  >
                    {s}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 text-xs">
                  <span
                    className={
                      "inline-block h-1.5 w-1.5 rounded-full " +
                      (a.online ? "bg-emerald-400" : "bg-zinc-600")
                    }
                  />
                  <span className="text-zinc-400">
                    {a.online
                      ? a.busyWith ?? "Online · ready to help"
                      : "Offline"}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                  <MessageSquare className="h-3 w-3" />
                  Chat
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              How do the agents work?
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              In v1, every agent is roleplayed by Anthropic Claude with a
              custom persona system prompt — that&apos;s why it works out of
              the box with just <code className="text-indigo-300">ANTHROPIC_API_KEY</code>.
              Drop in <code className="text-indigo-300">OPENAI_API_KEY</code>,{" "}
              <code className="text-indigo-300">GEMINI_API_KEY</code>, or{" "}
              <code className="text-indigo-300">GROQ_API_KEY</code> and we&apos;ll
              route each agent through its real provider.
            </p>
          </div>
          <Link
            href="/classroom/rooms/study-hall"
            className="ml-auto inline-flex items-center gap-1.5 self-center rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Try a room
          </Link>
        </div>
      </section>
    </main>
  );
}
