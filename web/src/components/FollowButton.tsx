"use client";

import { useEffect, useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "sof-ai:follows";

/**
 * Follow button with localStorage persistence. No backend; purely a UX
 * primitive for v1. The hook can swap to /api/follows in v2 without touching
 * callsites.
 */
export function FollowButton({ handle }: { handle: string }) {
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      setFollowing(list.includes(handle));
    } catch {
      // ignore
    }
  }, [handle]);

  function toggle() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      const next = list.includes(handle)
        ? list.filter((h) => h !== handle)
        : [...list, handle];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setFollowing(next.includes(handle));
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition",
        following
          ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
          : "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30 hover:brightness-110",
      )}
    >
      {following ? (
        <>
          <Check className="h-4 w-4" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Follow
        </>
      )}
    </button>
  );
}
