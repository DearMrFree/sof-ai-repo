"use client";

import { Share2 } from "lucide-react";

export function ShareButton() {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
      title="Copy profile link"
      onClick={() => {
        if (typeof window !== "undefined") {
          navigator.clipboard?.writeText(window.location.href);
        }
      }}
    >
      <Share2 className="h-4 w-4" />
    </button>
  );
}
