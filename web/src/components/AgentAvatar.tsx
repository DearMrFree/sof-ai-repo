"use client";

import { Agent } from "@/lib/agents";
import { cn } from "@/lib/cn";

/**
 * The minimal subset of an ``Agent`` (or ``StudentAgent``) needed to
 * render the avatar tile + online dot. Splitting this out lets us pass
 * either kind into the avatar without leaking the registry distinction
 * into the component.
 */
export type AgentAvatarSubject = Pick<
  Agent,
  "avatarGradient" | "emoji" | "online"
>;

export function AgentAvatar({
  agent,
  size = "md",
  showStatus = false,
}: {
  agent: AgentAvatarSubject;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showStatus?: boolean;
}) {
  const sizeClasses = {
    xs: "h-5 w-5 text-[10px]",
    sm: "h-7 w-7 text-xs",
    md: "h-10 w-10 text-base",
    lg: "h-14 w-14 text-xl",
    xl: "h-20 w-20 text-3xl",
  } as const;

  const statusSizes = {
    xs: "h-1.5 w-1.5",
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
    xl: "h-3.5 w-3.5",
  } as const;

  return (
    <div className="relative inline-block">
      <div
        className={cn(
          "flex flex-shrink-0 items-center justify-center rounded-xl font-semibold text-white shadow-lg",
          sizeClasses[size],
        )}
        style={{
          backgroundImage: `linear-gradient(135deg, ${agent.avatarGradient[0]}, ${agent.avatarGradient[1]})`,
          boxShadow: `0 8px 24px -8px ${agent.avatarGradient[0]}80`,
        }}
      >
        <span>{agent.emoji}</span>
      </div>
      {showStatus && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-zinc-950",
            statusSizes[size],
            agent.online ? "bg-emerald-400" : "bg-zinc-600",
          )}
          title={agent.online ? "Online" : "Offline"}
        />
      )}
    </div>
  );
}
