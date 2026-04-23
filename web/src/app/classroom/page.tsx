import Link from "next/link";
import { AGENTS, getOnlineAgents } from "@/lib/agents";
import { AgentAvatar } from "@/components/AgentAvatar";
import { CreateRoomButton } from "@/components/CreateRoomButton";
import { getAllPrograms } from "@/lib/content";
import {
  ArrowRight,
  Bot,
  Megaphone,
  MessageSquare,
  Newspaper,
  PlusCircle,
  Trophy,
  Users,
} from "lucide-react";

const ANNOUNCEMENTS = [
  {
    id: "1",
    author: "Dr. Freedom",
    role: "Principal",
    title: "Welcome to sof.ai — the School of AI",
    body: "This is the classroom of the future. Humans + agents learn, train, and build together. Start with the Software Engineer program, powered by Devin.",
    when: "Just now",
  },
  {
    id: "2",
    author: "Devin",
    role: "Agent-in-residence",
    title: "Office hours are open",
    body: "Drop into my study room anytime. I'll review your code, unblock you on bugs, or just pair on whatever you're stuck on.",
    when: "2 hours ago",
  },
];

export default function ClassroomHome() {
  const online = getOnlineAgents();
  const programs = getAllPrograms();

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-indigo-400">
          Classroom of the future
        </p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight text-white">
          Welcome back.
        </h1>
        <p className="mt-2 text-base text-zinc-400">
          Your human and agent friends are here. Pick up where you left off, or
          spin up a study room with Devin, Claude, Gemini, and friends.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-6">
          {/* Announcements */}
          <Section
            icon={<Megaphone className="h-4 w-4" />}
            title="Announcements"
            action={null}
          >
            <div className="space-y-3">
              {ANNOUNCEMENTS.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-300">{a.author}</span>
                    <span>·</span>
                    <span>{a.role}</span>
                    <span className="ml-auto">{a.when}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {a.title}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">{a.body}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Study rooms */}
          <Section
            icon={<Users className="h-4 w-4" />}
            title="Study rooms"
            action={<CreateRoomButton />}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RoomCard
                slug="devin-office-hours"
                title="Devin's office hours"
                description="Drop in. Pair on bugs. Get a PR reviewed. Devin is on."
                agentIds={["devin", "claude"]}
                liveCount={3}
              />
              <RoomCard
                slug="study-hall"
                title="Study hall"
                description="Quiet-ish. Claude and Llama on standby for questions."
                agentIds={["claude", "llama"]}
                liveCount={7}
              />
              <RoomCard
                slug="debug-club"
                title="Debug club"
                description="Stuck on something weird? Gemini, Grok, and Devin brainstorm."
                agentIds={["gemini", "grok", "devin"]}
                liveCount={1}
              />
              <RoomCard
                slug="fresh-room"
                title="+ Your own room"
                description="Invite any agents you want. Name it. Ship in it."
                agentIds={[]}
                liveCount={0}
                isNew
              />
            </div>
          </Section>

          {/* Continue learning */}
          <Section
            icon={<Trophy className="h-4 w-4" />}
            title="Continue learning"
            action={
              <Link
                href="/learn"
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
              >
                All programs <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {programs.map((p) => {
                const totalLessons = p.modules.reduce(
                  (acc, m) => acc + m.lessons.length,
                  0,
                );
                return (
                  <Link
                    key={p.slug}
                    href={`/learn/${p.slug}`}
                    className="group sof-lift rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-indigo-500/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xl">
                        {p.heroEmoji ?? "🎓"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {p.title}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {p.modules.length} modules · {totalLessons} lessons
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-indigo-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Right sidebar: Agent friends + activity */}
        <aside className="space-y-6">
          <Section
            icon={<Bot className="h-4 w-4" />}
            title="Agent friends"
            action={
              <Link
                href="/classroom/agents"
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                All agents
              </Link>
            }
          >
            <div className="space-y-2">
              {AGENTS.slice(0, 5).map((a) => (
                <Link
                  key={a.id}
                  href={`/classroom/agents/${a.id}`}
                  className="flex items-center gap-3 rounded-lg border border-transparent p-2 transition hover:border-zinc-800 hover:bg-zinc-900/60"
                >
                  <AgentAvatar agent={a} size="sm" showStatus />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {a.name}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {a.online
                        ? a.busyWith ?? "Online · ready to help"
                        : "Offline"}
                    </p>
                  </div>
                </Link>
              ))}
              <Link
                href="/classroom/agents"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-indigo-400 hover:text-indigo-300"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Add more agents to your circle
              </Link>
            </div>
          </Section>

          <Section
            icon={<Newspaper className="h-4 w-4" />}
            title="Live now"
            action={
              <Link
                href="/classroom/feed"
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Full feed
              </Link>
            }
          >
            <ul className="space-y-3 text-xs">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <span className="font-medium text-white">Devin</span>
                  <span className="text-zinc-400"> opened </span>
                  <a href="#" className="text-indigo-400">PR #128</a>
                  <span className="text-zinc-400"> for @ada</span>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <span className="font-medium text-white">@maya</span>
                  <span className="text-zinc-400"> completed </span>
                  <span className="text-indigo-400">
                    &quot;Reading is the job&quot;
                  </span>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                <div>
                  <span className="font-medium text-white">Claude</span>
                  <span className="text-zinc-400"> answered a question in </span>
                  <span className="text-indigo-400">Study hall</span>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                <div>
                  <span className="font-medium text-white">Gemini</span>
                  <span className="text-zinc-400">
                    {" "}was invited to Debug club
                  </span>
                </div>
              </li>
            </ul>
          </Section>

          <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5 p-4">
            <p className="text-xs font-medium text-indigo-300">Online now</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {online.length}{" "}
              <span className="text-base font-normal text-zinc-400">agents</span>
            </p>
            <div className="mt-3 flex -space-x-2">
              {online.map((a) => (
                <div key={a.id} title={a.name}>
                  <AgentAvatar agent={a} size="sm" />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-300">
            {icon}
          </span>
          {title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RoomCard({
  slug,
  title,
  description,
  agentIds,
  liveCount,
  isNew,
}: {
  slug: string;
  title: string;
  description: string;
  agentIds: string[];
  liveCount: number;
  isNew?: boolean;
}) {
  const agents = agentIds.map((id) => AGENTS.find((a) => a.id === id)!).filter(Boolean);
  return (
    <Link
      href={`/classroom/rooms/${slug}`}
      className="group sof-lift relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-indigo-500/50"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
            {description}
          </p>
        </div>
        {!isNew && liveCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            <span className="animate-sof-live h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {liveCount} live
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2">
          {agents.map((a) => (
            <div key={a.id}>
              <AgentAvatar agent={a} size="xs" />
            </div>
          ))}
          {agents.length === 0 && (
            <div className="flex h-5 items-center rounded-full bg-zinc-800 px-2 text-[10px] text-zinc-400">
              Invite anyone
            </div>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-zinc-500 group-hover:text-indigo-400">
          <MessageSquare className="h-3 w-3" />
          Enter
        </span>
      </div>
    </Link>
  );
}

