"use client";

import Link from "next/link";
import { Build } from "@/lib/builds";
import { AGENTS } from "@/lib/agents";
import { cn } from "@/lib/cn";
import { ArrowUpRight, MessageCircle, Sparkles, Star } from "lucide-react";

const STATUS_STYLE = {
  shipped: {
    label: "Shipped",
    dot: "bg-emerald-400",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  "in-progress": {
    label: "In progress",
    dot: "bg-amber-400",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  draft: {
    label: "Draft",
    dot: "bg-zinc-500",
    chip: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  },
} as const;

export function BuildCard({
  build,
  variant = "tile",
}: {
  build: Build;
  variant?: "tile" | "hero";
}) {
  const status = STATUS_STYLE[build.status];
  const collaborators = build.collaborators
    .map((id) => AGENTS.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const isHero = variant === "hero";

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 transition hover:border-zinc-700 hover:bg-zinc-900/70",
        isHero ? "md:grid md:grid-cols-[1.1fr_1fr] md:gap-0" : "",
      )}
    >
      {/* Cover */}
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden",
          isHero ? "aspect-[4/3] md:aspect-auto md:min-h-[260px]" : "aspect-[16/9]",
        )}
        style={{
          backgroundImage: `linear-gradient(135deg, ${build.cover.gradient[0]}, ${build.cover.gradient[1]})`,
        }}
      >
        {/* soft glow mesh */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-60 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.25), transparent 55%)",
          }}
        />
        <span className={cn("relative drop-shadow-lg", isHero ? "text-7xl" : "text-5xl")}>
          {build.cover.emoji}
        </span>

        {/* status chip */}
        <span
          className={cn(
            "absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium backdrop-blur",
            status.chip,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          {status.label}
        </span>

        {isHero && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
            <Sparkles className="h-3 w-3" />
            Featured
          </span>
        )}

        {/* progress bar for in-progress */}
        {typeof build.progressPct === "number" && build.status !== "shipped" && (
          <div className="absolute inset-x-3 bottom-3">
            <div className="h-1 overflow-hidden rounded-full bg-black/30">
              <div
                className="h-full bg-white/90"
                style={{ width: `${Math.max(4, build.progressPct)}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[10px] font-medium text-white/90">
              {build.progressPct}%
            </p>
          </div>
        )}
      </div>

      {/* Body */}
      <div className={cn("flex flex-col gap-3", isHero ? "p-6" : "p-4")}>
        <div>
          <h3
            className={cn(
              "font-semibold tracking-tight text-white",
              isHero ? "text-xl" : "text-base",
            )}
          >
            {build.title}
          </h3>
          <p className={cn("text-zinc-400", isHero ? "mt-2 text-sm" : "mt-1 text-[13px] leading-snug")}>
            {build.tagline}
          </p>
        </div>

        {isHero && (
          <p className="text-sm leading-relaxed text-zinc-300">{build.description}</p>
        )}

        {build.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {build.tags.slice(0, isHero ? 6 : 4).map((t) => (
              <span
                key={t}
                className="rounded-md border border-zinc-800 bg-zinc-950/70 px-2 py-0.5 text-[10px] text-zinc-400"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5" />
              {build.stars}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {build.comments}
            </span>
            {collaborators.length > 0 && (
              <span className="inline-flex items-center -space-x-1.5">
                {collaborators.slice(0, 3).map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ring-2 ring-zinc-900"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${a.avatarGradient[0]}, ${a.avatarGradient[1]})`,
                    }}
                    title={`${a.name} collaborated`}
                  >
                    {a.emoji}
                  </span>
                ))}
              </span>
            )}
          </div>

          {build.href && (
            <Link
              href={build.href}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-indigo-500/50 hover:text-white"
              target={build.href.startsWith("http") ? "_blank" : undefined}
              rel={build.href.startsWith("http") ? "noreferrer" : undefined}
            >
              {build.hrefLabel ?? "Open"}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
