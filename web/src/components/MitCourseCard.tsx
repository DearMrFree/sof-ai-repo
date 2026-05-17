"use client";

import { useState } from "react";
import { Video, FileText, BadgeCheck, Plus, Check, ExternalLink } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/cn";

export interface MitCourse {
  id: number;
  ocw_id: string;
  course_number: string;
  title: string;
  description: string;
  url: string;
  thumbnail_url: string;
  department: string;
  level: string;
  subjects: string[];
  instructors: string[];
  semester: string;
  year: number | null;
  has_video: boolean;
  has_assignments: boolean;
  school_approved: boolean;
}

interface Props {
  course: MitCourse;
  userId?: string;
  onSaved?: (courseId: number) => void;
  isSaved?: boolean;
}

export function MitCourseCard({ course, userId, onSaved, isSaved }: Props) {
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(isSaved ?? false);

  async function handleSave() {
    const uid = userId ?? (session?.user as { id?: string })?.id;
    if (!uid) return;
    setSaving(true);
    try {
      const res = await fetch("/api/planner/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid, course_id: course.id }),
      });
      if (res.ok) {
        setSaved(true);
        onSaved?.(course.id);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-indigo-500/40 hover:bg-zinc-900">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
            <span className="font-mono text-indigo-400">{course.course_number}</span>
            <span>·</span>
            <span>{course.department}</span>
            <span>·</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                course.level === "Graduate"
                  ? "bg-fuchsia-900/40 text-fuchsia-300"
                  : "bg-indigo-900/40 text-indigo-300",
              )}
            >
              {course.level}
            </span>
            {course.school_approved && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                <BadgeCheck className="h-2.5 w-2.5" />
                VR School
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold leading-snug text-white line-clamp-2">
            {course.title}
          </h3>
        </div>
        <a
          href={course.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
          title="Open on MIT OCW"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <p className="text-xs leading-relaxed text-zinc-400 line-clamp-3 flex-1">
        {course.description}
      </p>

      {course.instructors.length > 0 && (
        <p className="mt-2 text-[11px] text-zinc-500">
          {course.instructors.slice(0, 2).join(", ")}
          {course.instructors.length > 2 && " +more"}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          {course.has_video && (
            <span className="inline-flex items-center gap-1">
              <Video className="h-3 w-3 text-emerald-400" />
              Video
            </span>
          )}
          {course.has_assignments && (
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3 w-3 text-amber-400" />
              Assignments
            </span>
          )}
          {course.subjects.slice(0, 2).map((s) => (
            <span
              key={s}
              className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
            >
              {s}
            </span>
          ))}
        </div>

        {session?.user && (
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition",
              saved
                ? "bg-emerald-900/40 text-emerald-400 cursor-default"
                : "bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60",
            )}
          >
            {saved ? (
              <>
                <Check className="h-3 w-3" />
                Saved
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                {saving ? "Saving…" : "Save to Plan"}
              </>
            )}
          </button>
        )}
      </div>

      <p className="mt-3 border-t border-zinc-800 pt-2 text-[10px] text-zinc-600">
        © MIT OpenCourseWare · CC BY-NC-SA 4.0
      </p>
    </div>
  );
}
