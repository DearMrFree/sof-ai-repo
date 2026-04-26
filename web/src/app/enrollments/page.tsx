/**
 * /enrollments — public roster of School of AI students.
 *
 * Shows every active StudentEnrollment with their professor roster
 * (human + AI). The community can see who's currently being mentored,
 * who's a lead professor, and what track each student is on.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { GraduationCap, Users, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

interface Professor {
  id: number;
  professor_email: string;
  professor_name: string;
  professor_kind: "human" | "ai" | string;
  role: "lead" | "co_lead" | "guest" | string;
}

interface EnrollmentRow {
  id: number;
  application_id: number | null;
  student_name: string;
  student_email: string;
  agent_name: string;
  agent_url: string;
  track: string;
  status: string;
  notes: string;
  started_at: string;
  professors: Professor[];
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case "active":
      return {
        label: "Active",
        cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "paused":
      return {
        label: "Paused",
        cls: "bg-amber-50 text-amber-700 border-amber-200",
      };
    case "graduated":
      return {
        label: "Graduated",
        cls: "bg-violet-50 text-violet-700 border-violet-200",
      };
    case "withdrawn":
      return {
        label: "Withdrawn",
        cls: "bg-zinc-50 text-zinc-600 border-zinc-200",
      };
    default:
      return {
        label: status,
        cls: "bg-zinc-50 text-zinc-600 border-zinc-200",
      };
  }
}

async function loadEnrollments(): Promise<EnrollmentRow[]> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "sof.ai";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const res = await fetch(
    `${proto}://${host}/api/student-enrollments?limit=200`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  return (await res.json()) as EnrollmentRow[];
}

export default async function EnrollmentsPage() {
  const enrollments = await loadEnrollments();
  const active = enrollments.filter((e) => e.status === "active");
  const paused = enrollments.filter((e) => e.status === "paused");
  const graduated = enrollments.filter((e) => e.status === "graduated");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-emerald-600" />
          Students at School of AI
        </h1>
        <p className="mt-2 text-zinc-600 max-w-3xl">
          Every learner currently being mentored by sof.ai&apos;s human and AI
          professors. Click into any student to see their progress, agent, and
          full professor roster.
        </p>
        <div className="mt-4 flex items-center gap-4 text-sm text-zinc-600">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            {active.length} active
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-amber-500" />
            {paused.length} paused
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-violet-500" />
            {graduated.length} graduated
          </span>
        </div>
      </div>

      {enrollments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-zinc-600">
          No enrollments yet. The first cohort will appear here.
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {enrollments.map((e) => {
            const badge = statusBadge(e.status);
            const leads = e.professors.filter((p) => p.role === "lead");
            return (
              <li
                key={e.id}
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <Link
                  href={`/enrollments/${e.id}`}
                  className="block group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-900 group-hover:text-emerald-700">
                        {e.student_name}
                      </h2>
                      {e.agent_name && (
                        <p className="text-sm text-zinc-600 mt-0.5">
                          training{" "}
                          <span className="font-medium text-zinc-800">
                            {e.agent_name}
                          </span>
                          {e.agent_url && (
                            <>
                              {" "}
                              ·{" "}
                              <span className="text-emerald-700">
                                {e.agent_url.replace(/^https?:\/\//, "")}
                              </span>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  {e.track && (
                    <p className="mt-2 text-xs text-zinc-500 uppercase tracking-wide">
                      Track: {e.track.replace(/_/g, " ")}
                    </p>
                  )}
                  <div className="mt-4 border-t border-zinc-100 pt-3">
                    <p className="text-xs text-zinc-500 flex items-center gap-1 mb-2">
                      <Users className="h-3.5 w-3.5" />
                      Lead professors
                    </p>
                    <ul className="space-y-1">
                      {leads.length === 0 && (
                        <li className="text-sm text-zinc-400">
                          (no leads assigned yet)
                        </li>
                      )}
                      {leads.map((p) => (
                        <li
                          key={p.id}
                          className="text-sm text-zinc-800 flex items-center gap-2"
                        >
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${
                              p.professor_kind === "ai"
                                ? "bg-violet-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          {p.professor_name || p.professor_email}
                          <span className="text-xs text-zinc-400">
                            {p.professor_kind === "ai" ? "AI" : "human"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
