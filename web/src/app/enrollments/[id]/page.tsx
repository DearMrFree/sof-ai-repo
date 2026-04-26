/**
 * /enrollments/[id] — public detail page for one StudentEnrollment.
 *
 * Shows the student, their agent, full professor roster (lead /
 * co-lead / guest), notes from the lead professors, and a link back
 * to the original AgentApplication if one exists.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  GraduationCap,
  ArrowUpRight,
  Calendar,
  Sparkles,
  Users,
  FileText,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface Professor {
  id: number;
  professor_email: string;
  professor_name: string;
  professor_kind: "human" | "ai" | string;
  role: "lead" | "co_lead" | "guest" | string;
  added_at: string;
}

interface EnrollmentDetail {
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
  updated_at: string;
  professors: Professor[];
}

async function loadEnrollment(id: string): Promise<EnrollmentDetail | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "sof.ai";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const res = await fetch(`${proto}://${host}/api/student-enrollments/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as EnrollmentDetail;
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

function roleLabel(role: string): string {
  switch (role) {
    case "lead":
      return "Lead professor";
    case "co_lead":
      return "Co-lead";
    case "guest":
      return "Guest";
    default:
      return role;
  }
}

export default async function EnrollmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const e = await loadEnrollment(id);
  if (!e) notFound();

  const badge = statusBadge(e.status);
  const leads = e.professors.filter((p) => p.role === "lead");
  const coLeads = e.professors.filter((p) => p.role === "co_lead");
  const guests = e.professors.filter((p) => p.role === "guest");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-2">
        <Link
          href="/enrollments"
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← All students
        </Link>
      </div>
      <div className="mb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <GraduationCap className="h-7 w-7 text-emerald-600" />
              {e.student_name}
            </h1>
            {e.agent_name && (
              <p className="mt-1 text-zinc-600">
                training{" "}
                <span className="font-medium text-zinc-900">
                  {e.agent_name}
                </span>
                {e.agent_url && (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      className="text-emerald-700 hover:underline inline-flex items-center gap-1"
                      href={e.agent_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {e.agent_url.replace(/^https?:\/\//, "")}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm text-zinc-500">
          {e.track && (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              {e.track.replace(/_/g, " ")}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            since {new Date(e.started_at).toLocaleDateString()}
          </span>
          {e.application_id && (
            <Link
              href={`/applications/${e.application_id}`}
              className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              application #{e.application_id}
            </Link>
          )}
        </div>
      </div>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-emerald-600" />
          Professor roster
        </h2>
        {leads.length > 0 && (
          <ProfessorGroup label={roleLabel("lead")} professors={leads} />
        )}
        {coLeads.length > 0 && (
          <ProfessorGroup label={roleLabel("co_lead")} professors={coLeads} />
        )}
        {guests.length > 0 && (
          <ProfessorGroup label={roleLabel("guest")} professors={guests} />
        )}
        {e.professors.length === 0 && (
          <p className="text-zinc-500">
            No professors assigned yet — contact the trio to attach mentors.
          </p>
        )}
      </section>

      {e.notes && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 mb-3">
            Progress notes
          </h2>
          <div className="rounded-lg border border-zinc-200 bg-white p-5 whitespace-pre-wrap text-zinc-800 leading-relaxed">
            {e.notes}
          </div>
        </section>
      )}
    </div>
  );
}

function ProfessorGroup({
  label,
  professors,
}: {
  label: string;
  professors: Professor[];
}) {
  return (
    <div className="mb-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
        {label}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {professors.map((p) => (
          <li
            key={p.id}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-3 flex items-center gap-3"
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                p.professor_kind === "ai" ? "bg-violet-500" : "bg-emerald-500"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">
                {p.professor_name || p.professor_email}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {p.professor_kind === "ai" ? "AI agent" : "human"} ·{" "}
                {p.professor_email}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
