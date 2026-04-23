"use client";

import { Share2 } from "lucide-react";
import { useToast } from "@/components/Toast";

export function ShareButton() {
  const toast = useToast();

  async function onShare() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    // Prefer the native share sheet on mobile; fall back to copying the URL
    // to the clipboard everywhere else.
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: document.title,
          url,
        });
        return;
      }
    } catch {
      // User cancelled the native share sheet — fall through to clipboard.
    }
    try {
      await navigator.clipboard?.writeText(url);
      toast.push({ message: "Profile link copied to clipboard.", tone: "success" });
    } catch {
      toast.push({ message: "Couldn't copy the link.", tone: "error" });
    }
  }

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
      title="Share profile"
      onClick={onShare}
    >
      <Share2 className="h-4 w-4" />
    </button>
  );
}
