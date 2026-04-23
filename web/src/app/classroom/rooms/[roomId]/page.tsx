import Link from "next/link";
import { notFound } from "next/navigation";
import { AGENTS } from "@/lib/agents";
import { ROOMS, getRoom, getRoomAgents } from "@/lib/rooms";
import { AgentAvatar } from "@/components/AgentAvatar";
import { RoomChat } from "@/components/RoomChat";
import { ChevronRight, Users } from "lucide-react";

export function generateStaticParams() {
  return ROOMS.map((r) => ({ roomId: r.slug }));
}

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const room = getRoom(params.roomId);
  if (!room) notFound();
  const agents = getRoomAgents(room);
  // Also let the user invite other agents.
  const inviteable = AGENTS.filter((a) => !room.agentIds.includes(a.id));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/classroom" className="hover:text-white">
          Classroom
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>Rooms</span>
        <ChevronRight className="h-3 w-3" />
        <span>{room.title}</span>
      </div>

      <header className="mb-4 flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
            {room.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">{room.description}</p>
          {room.topic && (
            <p className="mt-2 text-xs text-zinc-500">
              <span className="text-zinc-400">Topic:</span> {room.topic}
              {room.vibe && (
                <>
                  <span className="mx-2">·</span>
                  <span className="text-zinc-400">Vibe:</span> {room.vibe}
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
            <Users className="h-3.5 w-3.5 text-indigo-400" />
            {agents.length} agents in this room
          </div>
          <div className="flex -space-x-2">
            {agents.map((a) => (
              <div key={a.id} title={a.name}>
                <AgentAvatar agent={a} size="sm" showStatus />
              </div>
            ))}
          </div>
        </div>
      </header>

      <RoomChat
        initialAgents={agents}
        inviteableAgents={inviteable}
        topic={room.topic ?? room.title}
      />
    </main>
  );
}
