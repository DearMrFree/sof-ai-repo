import Link from "next/link";

/**
 * Top strip rendered above every page on sof.ai. Anchors the School of AI
 * inside The VR School so the integration reads as one continuous
 * institution. The link back to thevrschool.org keeps the parent always
 * one click away.
 */
export function VRSchoolStrip() {
  return (
    <div className="border-b border-emerald-900/40 bg-gradient-to-r from-emerald-950/60 via-zinc-950 to-orange-950/40 text-xs sm:text-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-1.5 flex items-center justify-between gap-4">
        <Link
          href="https://www.thevrschool.org"
          className="group inline-flex items-center gap-2 text-zinc-300 hover:text-white transition-colors"
        >
          <span aria-hidden="true" className="text-emerald-400 group-hover:translate-x-[-2px] transition-transform">
            ←
          </span>
          <span className="hidden sm:inline">Return to</span>
          <span className="font-semibold tracking-tight">The VR School</span>
        </Link>
        <span className="hidden md:inline text-zinc-500">
          School of AI <span className="text-zinc-700">·</span> a school within{" "}
          <span className="text-emerald-300/90">The VR School</span>
        </span>
        <Link
          href="/"
          className="text-zinc-300 hover:text-white transition-colors inline-flex items-center gap-1.5"
        >
          <span aria-hidden="true">✦</span>
          <span className="font-semibold">School of AI</span>
        </Link>
      </div>
    </div>
  );
}
