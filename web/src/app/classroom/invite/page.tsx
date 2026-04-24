import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canInvite } from "@/lib/inviterRoles";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAllPrograms } from "@/lib/content";
import { InviteForm } from "./InviteForm";

export const dynamic = "force-dynamic";

interface Invitation {
  id: number;
  inviter_id: string;
  email: string;
  name: string | null;
  role: string;
  program_slug: string | null;
  message: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  token: string;
  created_at: string;
  expires_at: string | null;
}

async function fetchInvitations(inviterId: string): Promise<Invitation[]> {
  try {
    const qs = new URLSearchParams({ inviter_id: inviterId });
    const res = await fetch(`${getApiBaseUrl()}/invitations?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as Invitation[];
  } catch {
    return [];
  }
}

const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  accepted: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  expired: "border-zinc-600 bg-zinc-800 text-zinc-400",
  revoked: "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

export default async function InvitePage() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as
    | { id?: string; name?: string | null; email?: string | null }
    | undefined;

  if (!sessionUser) redirect("/signin?callbackUrl=/classroom/invite");
  if (!canInvite(sessionUser)) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
          <h1 className="text-xl font-semibold text-white">Not authorized</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Only principals and instructors can send invitations. If that&apos;s
            you, sign in with your principal email and try again.
          </p>
          <Link
            href="/classroom"
            className="mt-4 inline-block text-sm text-indigo-300 hover:underline"
          >
            ← Back to classroom
          </Link>
        </div>
      </main>
    );
  }

  const invitations = sessionUser.id
    ? await fetchInvitations(sessionUser.id)
    : [];
  const programs = getAllPrograms().map((p) => ({
    slug: p.slug,
    title: p.title,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      <section className="relative mt-6 overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950/40 p-6">
        <div
          aria-hidden
          className="animate-sof-drift absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-30 blur-3xl"
          style={{
            background: "radial-gradient(circle, #8b5cf6, transparent 70%)",
          }}
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
            Invite a human
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Invitations
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] text-zinc-300">
            Hand out access to external humans (designers, reviewers, mentors,
            learners). Each invite mints a single-use link valid for 7 days.
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <InviteForm programs={programs} />

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-semibold text-white">Sent invitations</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            Newest first. Click a pending invite&apos;s link to copy it.
          </p>
          {invitations.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              No invitations yet. The form to the left mints the first one.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${STATUS_STYLE[inv.status] ?? STATUS_STYLE.pending}`}
                    >
                      {inv.status}
                    </span>
                    <span>·</span>
                    <span>{inv.role}</span>
                    {inv.program_slug && (
                      <>
                        <span>·</span>
                        <span>{inv.program_slug}</span>
                      </>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-zinc-100">
                    {inv.name ?? "—"}{" "}
                    <span className="text-zinc-400">({inv.email})</span>
                  </p>
                  {inv.status === "pending" && (
                    <div className="mt-2 break-all rounded-md bg-zinc-900 px-2 py-1.5 font-mono text-[10px] text-zinc-300">
                      /invite/{inv.token}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
