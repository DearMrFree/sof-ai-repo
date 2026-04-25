import { Agent } from "@/lib/agents";
import { Sparkles } from "lucide-react";

/**
 * Small inline badge: green dot + "In office" label + capability blurb.
 *
 * v1 treats every agent with an ``officeHours`` config as always
 * online. The component is a no-op (returns null) for agents without an
 * office-hours config so it can be sprinkled freely on agent cards.
 */
export function OfficeHoursBadge({
  agent,
  size = "sm",
}: {
  agent: Agent;
  size?: "sm" | "xs";
}) {
  if (!agent.officeHours) return null;

  const padding = size === "xs" ? "px-2 py-0.5" : "px-2.5 py-1";
  const text = size === "xs" ? "text-[10px]" : "text-xs";
  const dotSize = size === "xs" ? "h-1.5 w-1.5" : "h-2 w-2";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 ${padding} ${text} font-medium text-emerald-300`}
      title={agent.officeHours.blurb}
    >
      <span className="relative flex">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40 ${dotSize}`}
        />
        <span className={`relative inline-flex rounded-full bg-emerald-400 ${dotSize}`} />
      </span>
      <Sparkles className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      <span>{agent.officeHours.blurb}</span>
    </span>
  );
}
