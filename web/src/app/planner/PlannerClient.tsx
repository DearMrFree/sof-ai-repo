"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface PlanItem {
  id: number;
  user_id: string;
  course_id: number;
  course_title: string;
  course_number: string;
  course_url: string;
  department: string;
  level: string;
  status: string;
  notes: string;
  added_at: string;
  updated_at: string;
}

const STATUSES = [
  { key: "interested", label: "Interested", icon: Circle, color: "text-zinc-400" },
  { key: "planned", label: "Planned", icon: Clock, color: "text-amber-400" },
  { key: "in_progress", label: "In Progress", icon: BookOpen, color: "text-indigo-400" },
  { key: "completed", label: "Completed", icon: CheckCircle2, color: "text-emerald-400" },
] as const;

interface Props {
  userId: string;
}

export function PlannerClient({ userId }: Props) {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/planner/items?user_id=${encodeURIComponent(userId)}`,
      );
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(item: PlanItem, status: string) {
    setUpdating(item.id);
    try {
      const res = await fetch(
        `/api/planner/items/${item.id}?user_id=${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (res.ok) {
        const updated: PlanItem = await res.json();
        setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function saveNotes(item: PlanItem) {
    setUpdating(item.id);
    try {
      const res = await fetch(
        `/api/planner/items/${item.id}?user_id=${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: notesDraft }),
        },
      );
      if (res.ok) {
        const updated: PlanItem = await res.json();
        setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      }
    } finally {
      setUpdating(null);
      setEditingNotes(null);
    }
  }

  async function removeItem(item: PlanItem) {
    setUpdating(item.id);
    try {
      await fetch(
        `/api/planner/items/${item.id}?user_id=${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center">
        <BookOpen className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
        <p className="text-sm text-zinc-400">Your academic plan is empty.</p>
        <p className="mt-1 text-xs text-zinc-500">
          Browse the{" "}
          <a href="/catalog" className="text-indigo-400 underline">
            Course Catalog
          </a>{" "}
          and click &ldquo;Save to Plan&rdquo; on any course.
        </p>
      </div>
    );
  }

  const grouped = STATUSES.map((s) => ({
    ...s,
    items: items.filter((i) => i.status === s.key),
  }));
  const completedCount = items.filter((i) => i.status === "completed").length;

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-zinc-300 font-medium">
            {completedCount} of {items.length} course{items.length !== 1 ? "s" : ""} completed
          </span>
          <span className="text-zinc-500">
            {Math.round((completedCount / items.length) * 100)}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all"
            style={{ width: `${(completedCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {grouped.map(({ key, label, icon: Icon, color, items: colItems }) => (
          <div key={key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", color)} />
              <h2 className="text-sm font-semibold text-white">{label}</h2>
              <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                {colItems.length}
              </span>
            </div>

            {colItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-600">
                None yet
              </div>
            ) : (
              colItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700"
                >
                  <div className="mb-1 flex items-start justify-between gap-1">
                    <div className="flex-1">
                      <p className="text-[11px] font-mono text-indigo-400">
                        {item.course_number}
                      </p>
                      <p className="mt-0.5 text-xs font-medium leading-snug text-white line-clamp-2">
                        {item.course_title}
                      </p>
                    </div>
                    <a
                      href={item.course_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded p-1 text-zinc-600 hover:text-zinc-300"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <p className="mb-3 text-[11px] text-zinc-500">{item.department}</p>

                  {/* Notes */}
                  {editingNotes === item.id ? (
                    <div className="mb-3">
                      <textarea
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        rows={2}
                        className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-xs text-white outline-none focus:border-indigo-500"
                        placeholder="Add notes…"
                      />
                      <div className="mt-1 flex gap-2">
                        <button
                          onClick={() => saveNotes(item)}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingNotes(null)}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setNotesDraft(item.notes);
                        setEditingNotes(item.id);
                      }}
                      className="mb-3 w-full rounded border border-dashed border-zinc-700 p-2 text-left text-[11px] text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
                    >
                      {item.notes || "Add notes…"}
                    </button>
                  )}

                  {/* Status buttons */}
                  <div className="flex flex-wrap gap-1">
                    {STATUSES.filter((s) => s.key !== key).map((s) => (
                      <button
                        key={s.key}
                        disabled={updating === item.id}
                        onClick={() => updateStatus(item, s.key)}
                        className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400 transition hover:bg-zinc-700 hover:text-white disabled:opacity-40"
                      >
                        → {s.label}
                      </button>
                    ))}
                    <button
                      disabled={updating === item.id}
                      onClick={() => removeItem(item)}
                      className="ml-auto rounded p-1 text-zinc-600 transition hover:text-red-400 disabled:opacity-40"
                      title="Remove from plan"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
