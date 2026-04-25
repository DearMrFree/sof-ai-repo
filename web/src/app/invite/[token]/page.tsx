import Link from "next/link";
import { notFound } from "next/navigation";
import { getApiBaseUrl } from "@/lib/apiBase";
import { AcceptInviteButton } from "./AcceptInviteButton";

export const dynamic = "force-dynamic";

interface Invitation {
  id: number;
  inviter_id: string;
  email: string;
  name: string | null;
  role: string;
  message: string | null;
  program_slug: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  token: string;
  created_at: string;
  expires_at: string | null;
  accepted_at: string | null;
  accepted_user_id: string | null;
}

async function fetchInvitation(token: string): Promise<Invitation | null> {
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/invitations/accept/${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as Invitation;
  } catch {
    return null;
  }
}

const ROLE_BLURB: Record<string, string> = {
  contributor:
    "Log feedback, review UI, open issues. Your eye shapes what ships next.",
  reviewer: "Review Devin-authored PRs and spot design regressions early.",
  mentor: "Mentor learners through the Software Engineer program cohort.",
  learner: "Enroll in programs and ship capstones alongside Devin.",
};

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const invite = await fetchInvitation(params.token);
  if (!invite) notFound();

  const roleBlurb = ROLE_BLURB[invite.role] ?? ROLE_BLURB.contributor;
  const isPending = invite.status === "pending";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950/40 p-8 shadow-2xl">
        <div
          aria-hidden
          className="animate-sof-drift absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-30 blur-3xl"
          style={{
            background: "radial-gradient(circle, #8b5cf6, transparent 70%)",
          }}
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
            You&apos;re invited to sof.ai
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            {invite.name ? `Welcome, ${invite.name.split(" ")[0]}.` : "Welcome."}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">
            You&apos;ve been invited to join the School of AI as a{" "}
            <span className="font-semibold text-white">{invite.role}</span>.{" "}
            {roleBlurb}
          </p>

          {invite.program_slug && (
            <p className="mt-2 text-sm text-zinc-400">
              Program access:{" "}
              <Link
                href={`/learn/${invite.program_slug}`}
                className="text-indigo-300 hover:underline"
              >
                {invite.program_slug}
              </Link>
            </p>
          )}

          {invite.message && (
            <blockquote className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-[14px] italic leading-relaxed text-zinc-200">
              &ldquo;{invite.message}&rdquo;
            </blockquote>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {isPending ? (
              <AcceptInviteButton
                token={invite.token}
                email={invite.email}
                name={invite.name}
                programSlug={invite.program_slug}
              />
            ) : (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-300">
                This invitation is <b>{invite.status}</b>. Reach out to whoever
                sent it if you still need access.
              </div>
            )}
            <p className="text-[11px] text-zinc-500">
              Invited email: <span className="text-zinc-300">{invite.email}</span>
            </p>
          </div>
        </div>
      </section>

      <p className="mt-6 text-center text-[12px] text-zinc-500">
        Already have a sof.ai account?{" "}
        <Link href="/signin" className="text-indigo-300 hover:underline">
          Sign in
        </Link>{" "}
        first, then reopen this link.
      </p>
    </main>
  );
}
