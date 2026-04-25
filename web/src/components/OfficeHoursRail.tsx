import Link from "next/link";
import { getOfficeHoursAgents } from "@/lib/agents";
import { AgentAvatar } from "@/components/AgentAvatar";
import { Sparkles, Upload, Rocket } from "lucide-react";

/**
 * Horizontal rail listing every agent currently in office. Pinned to
 * the top of ``/classroom`` and linked from each card to the agent
 * detail page (which renders the chat + capability-specific actions).
 *
 * v1: every agent with an ``officeHours`` config is in office 24/7,
 * so the rail is essentially "agents you can drop a file with /
 * kickoff a Devin session against right now".
 */
export function OfficeHoursRail() {
  const agents = getOfficeHoursAgents();

  if (agents.length === 0) return null;

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-300">
            Office hours
          </h2>
          <span className="text-xs text-zinc-500">
            · drop a file with Claude · one-click Devin sessions
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {agents.map((agent) => {
          const caps = agent.officeHours?.capabilities ?? [];
          return (
            <Link
              key={agent.id}
              href={`/classroom/agents/${agent.id}`}
              className="group flex min-w-[220px] flex-1 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 transition hover:border-emerald-500/40 hover:bg-zinc-900"
            >
              <AgentAvatar agent={agent} size="md" showStatus />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">
                  {agent.name}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                  {agent.officeHours?.blurb ?? "In office"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {caps.includes("file_analysis") && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                      <Upload className="h-2.5 w-2.5" /> Files
                    </span>
                  )}
                  {caps.includes("devin_kickoff") && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                      <Rocket className="h-2.5 w-2.5" /> Sessions
                    </span>
                  )}
                  {caps.includes("cowork") && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                      <Sparkles className="h-2.5 w-2.5" /> Cowork
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
