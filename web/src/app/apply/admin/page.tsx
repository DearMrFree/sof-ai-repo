/**
 * /apply/admin — internal dashboard for Dr. Cheteni.
 *
 * Lists every application (not just public ones), shows where each is
 * in the pipeline, and lets the admin re-trigger Devin's vet via a
 * single button (POST /api/applications/{id}/vet) if the inline vet
 * failed during submission.
 *
 * Gated on the Freedom email — non-admin users get a friendly 403 page.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { APPROVER_EMAIL } from "@/lib/applications/trio";
import { ReVetButton } from "./revet-button";

export const dynamic = "force-dynamic";

interface AdminRow {
  id: number;
  applicant_name: string;
  agent_name: string;
  applicant_kind: string;
  applicant_email: string;
  status: string;
  vet_status: string;
  submitted_at: string;
}

async function fetchAll(): Promise<AdminRow[]> {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  try {
    const res = await fetch(`${proto}://${host}/api/applications`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as AdminRow[];
  } catch {
    return [];
  }
}

export default async function ApplyAdminPage() {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").trim().toLowerCase();
  if (email !== APPROVER_EMAIL) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-10">
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-rose-100">
          <h1 className="text-lg font-semibold">Admin only</h1>
          <p className="mt-2 text-sm">
            The admin dashboard is for Dr. Freedom Cheteni. Public status pages
            for individual applications are at{" "}
            <Link href="/apply/public" className="underline">
              /apply/public
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }

  const rows = await fetchAll();
  const grouped = {
    submitted: rows.filter((r) =>
      ["submitted", "vetting"].includes(r.status),
    ),
    revising: rows.filter((r) => r.status === "vetted_revise"),
    trio: rows.filter((r) => r.status === "trio_reviewing"),
    accepted: rows.filter((r) => r.status === "conditionally_accepted"),
    declined: rows.filter((r) =>
      ["declined", "vetted_reject"].includes(r.status),
    ),
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-10">
      <header className="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-300">
          Admin · Agent onboarding
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          {rows.length} application{rows.length === 1 ? "" : "s"} on file.
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Re-vet button below the row only fires Devin&apos;s first-pass vet
          again — useful if the inline vet failed during submission. Trio
          emails will resend on a fresh pass.
        </p>
      </header>

      <Section title="Awaiting Devin's vet" rows={grouped.submitted} />
      <Section title="Trio reviewing" rows={grouped.trio} />
      <Section title="Devin asked for revisions" rows={grouped.revising} />
      <Section title="Conditionally accepted" rows={grouped.accepted} />
      <Section title="Declined" rows={grouped.declined} />
    </main>
  );
}

function Section({ title, rows }: { title: string; rows: AdminRow[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Empty.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/applications/${r.id}`}
                  className="text-sm font-semibold text-white hover:text-fuchsia-300"
                >
                  #{r.id} {r.applicant_name}
                  {r.agent_name ? (
                    <span className="text-zinc-400"> · {r.agent_name}</span>
                  ) : null}
                </Link>
                <span className="text-xs text-zinc-500">
                  {r.applicant_email} · {r.applicant_kind.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300">
                  status: {r.status.replace(/_/g, " ")}
                </span>
                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300">
                  vet: {r.vet_status.replace(/_/g, " ")}
                </span>
                <span className="ml-auto text-xs text-zinc-500">
                  {new Date(r.submitted_at).toLocaleString()}
                </span>
                <ReVetButton applicationId={r.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
