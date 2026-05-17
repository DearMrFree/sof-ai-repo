"use client";

import { BadgeCheck, ExternalLink, Printer, BookOpen, GraduationCap } from "lucide-react";
import { cn } from "@/lib/cn";
import type { TranscriptData } from "./page";

interface Props {
  transcript: TranscriptData | null;
  studentName: string;
  userId: string;
}

const STATUS_COLORS: Record<string, string> = {
  in_progress: "text-blue-400 border-blue-800",
  planned: "text-indigo-400 border-indigo-800",
  interested: "text-zinc-400 border-zinc-700",
  completed: "text-emerald-400 border-emerald-800",
};

const STATUS_DOT: Record<string, string> = {
  in_progress: "bg-blue-400",
  planned: "bg-indigo-400",
  interested: "bg-zinc-500",
  completed: "bg-emerald-400",
};

export function TranscriptView({ transcript, studentName, userId }: Props) {
  function handlePrint() {
    window.print();
  }

  const generated = transcript
    ? new Date(transcript.generated_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div>
      {/* Screen header */}
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs uppercase tracking-wider text-indigo-400">ibuildme.cv</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Aspirational Transcript
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Your MIT OpenCourseWare academic plan, approved by The VR School.{" "}
            <a href="/planner" className="text-indigo-400 underline">
              Edit your plan →
            </a>
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
        >
          <Printer className="h-4 w-4" />
          Print / Export
        </button>
      </div>

      {/* Transcript document */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 print:border-0 print:bg-white print:text-black">
        {/* School header */}
        <div className="border-b border-zinc-800 px-8 py-6 print:border-zinc-300">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-400 print:text-black" />
                <span className="text-lg font-bold tracking-tight text-white print:text-black">
                  THE VR SCHOOL
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500 print:text-zinc-600">
                WASC-Accredited K–12 · thevrschool.org
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 print:text-zinc-600">
                Aspirational Academic Transcript
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 print:text-zinc-600">
                ibuildme.cv · Generated {generated}
              </p>
            </div>
          </div>

          {/* Student info */}
          <div className="mt-5 grid grid-cols-2 gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-5 py-3 text-sm print:border-zinc-300 print:bg-zinc-50">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500 print:text-zinc-600">
                Student
              </p>
              <p className="mt-0.5 font-medium text-white print:text-black">{studentName}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500 print:text-zinc-600">
                Catalog Source
              </p>
              <p className="mt-0.5 font-medium text-white print:text-black">MIT OpenCourseWare</p>
            </div>
            {transcript && (
              <>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 print:text-zinc-600">
                    Total Courses
                  </p>
                  <p className="mt-0.5 font-medium text-white print:text-black">
                    {transcript.total_courses}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 print:text-zinc-600">
                    VR School Approved
                  </p>
                  <p className="mt-0.5 font-medium text-emerald-400 print:text-emerald-700">
                    {transcript.approved_count} of {transcript.total_courses}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {!transcript || transcript.total_courses === 0 ? (
            <div className="py-16 text-center">
              <BookOpen className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">Your transcript is empty.</p>
              <p className="mt-1 text-xs text-zinc-500">
                Browse the{" "}
                <a href="/catalog" className="text-indigo-400 underline">
                  MIT OCW Catalog
                </a>{" "}
                and save courses to build your aspirational transcript.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {transcript.sections.map((section) => (
                <div key={section.status}>
                  {/* Section header */}
                  <div
                    className={cn(
                      "mb-3 flex items-center gap-2 border-b pb-1.5 text-xs font-semibold uppercase tracking-widest print:border-zinc-300",
                      STATUS_COLORS[section.status] ?? "text-zinc-400 border-zinc-700",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        STATUS_DOT[section.status] ?? "bg-zinc-500",
                      )}
                    />
                    {section.label}
                    <span className="ml-1 font-normal normal-case text-zinc-600 print:text-zinc-400">
                      ({section.courses.length} course{section.courses.length !== 1 ? "s" : ""})
                    </span>
                  </div>

                  {/* Course rows */}
                  <div className="divide-y divide-zinc-800/60 print:divide-zinc-200">
                    {section.courses.map((course) => (
                      <div
                        key={course.plan_item_id}
                        className="flex items-start gap-4 py-3"
                      >
                        <div className="w-20 shrink-0">
                          <span className="font-mono text-xs text-indigo-400 print:text-indigo-700">
                            {course.course_number}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <a
                              href={course.course_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex items-center gap-1 text-sm font-medium text-white hover:text-indigo-300 print:text-black print:no-underline"
                            >
                              {course.course_title}
                              <ExternalLink className="h-3 w-3 opacity-0 transition group-hover:opacity-60 print:hidden" />
                            </a>
                            {course.school_approved && (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-900/40 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400 print:border print:border-emerald-600 print:bg-transparent print:text-emerald-700">
                                <BadgeCheck className="h-2.5 w-2.5" />
                                VR School
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-zinc-500 print:text-zinc-600">
                            {course.department} · {course.level} · {course.source}
                          </p>
                          {course.notes && (
                            <p className="mt-1 text-[11px] italic text-zinc-600 print:text-zinc-500">
                              {course.notes}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <span
                            className={cn(
                              "text-[10px] font-medium",
                              STATUS_COLORS[course.status]?.split(" ")[0] ?? "text-zinc-500",
                            )}
                          >
                            {section.label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-8 py-4 print:border-zinc-300">
          <p className="text-[10px] text-zinc-600 print:text-zinc-500">
            Course materials © MIT OpenCourseWare, CC BY-NC-SA 4.0 ·
            This is an aspirational transcript documenting independent study goals,
            not an official academic credential. ·{" "}
            <span className="print:hidden">
              Generated at{" "}
              <a href="https://thevrschool.org" className="underline">
                thevrschool.org
              </a>
            </span>
            <span className="hidden print:inline">thevrschool.org</span>
          </p>
        </div>
      </div>
    </div>
  );
}
