"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";

export function CreateRoomButton() {
  return (
    <Link
      href="/classroom/rooms/new"
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
    >
      <PlusCircle className="h-3.5 w-3.5" />
      New room
    </Link>
  );
}
