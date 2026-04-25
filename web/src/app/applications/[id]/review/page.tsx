/**
 * /applications/{id}/review — token-gated review page for the trio.
 *
 * Reviewers (Freedom + Garth Corea + Esther Wojcicki) get a signed
 * link in their email. The token in the URL identifies which trio
 * member is voting; we render a thumbs-up / thumbs-down / maybe form
 * with a comment box. On submit the proxy validates the HMAC, records
 * the vote, and (if the trio is now complete) runs Devin's synthesis +
 * finalize the application.
 *
 * Tokens are NOT single-use — reviewers can change their mind until
 * the trio is fully voted and Devin synthesizes. After that the
 * application is terminal.
 */
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ReviewForm } from "./review-form";
import { verifyReviewToken } from "@/lib/applications/token";
import { findTrioReviewer } from "@/lib/applications/trio";

export const dynamic = "force-dynamic";

interface ApplicationDetail {
  id: number;
  applicant_name: string;
  applicant_kind: string;
  agent_name: string;
  org_name: string;
  agent_url: string;
  mission_statement: string;
  apa_statement: string;
  vet_status: string;
  vet_reasoning: string;
  vet_recommendation: string;
  status: string;
  reviews: Array<{
    reviewer_email: string;
    vote: "yes" | "no" | "maybe";
    comment: string;
  }>;
}

async function fetchApplication(id: number): Promise<ApplicationDetail | null> {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  try {
    const res = await fetch(`${proto}://${host}/api/applications/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ApplicationDetail;
  } catch {
    return null;
  }
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { token?: string };
}) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const token = searchParams.token ?? "";
  if (!token) {
    return (
      <Shell>
        <Banner tone="rose" title="Missing reviewer token">
          The review link is incomplete. Ask Devin to re-send the email.
        </Banner>
      </Shell>
    );
  }
  const claims = verifyReviewToken(token);
  if (!claims || claims.applicationId !== id) {
    return (
      <Shell>
        <Banner tone="rose" title="Invalid or expired reviewer token">
          The link couldn&apos;t be verified. Tokens expire after 30 days.
          Ask Devin to re-send the email.
        </Banner>
      </Shell>
    );
  }
  const reviewer = findTrioReviewer(claims.reviewerEmail);
  if (!reviewer) {
    return (
      <Shell>
        <Banner tone="rose" title="Not on the steering trio">
          Only Dr. Freedom Cheteni, Garth Corea (APA), and Esther Wojcicki can
          vote on applications.
        </Banner>
      </Shell>
    );
  }
  const application = await fetchApplication(id);
  if (!application) notFound();

  if (
    application.status !== "trio_reviewing" &&
    application.status !== "vetted_pass"
  ) {
    if (
      application.status === "conditionally_accepted" ||
      application.status === "declined"
    ) {
      redirect(`/applications/${id}`);
    }
    return (
      <Shell>
        <Banner tone="amber" title={`Application is ${application.status.replace(/_/g, " ")}`}>
          Only applications in the &quot;trio reviewing&quot; phase can accept
          new votes.
        </Banner>
      </Shell>
    );
  }

  const myExisting = application.reviews.find(
    (r) => r.reviewer_email.toLowerCase() === reviewer.email,
  );

  return (
    <Shell>
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-300">
          Reviewing as {reviewer.name}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          {application.applicant_name}
          {application.agent_name ? (
            <span className="text-zinc-400"> · {application.agent_name}</span>
          ) : null}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {application.applicant_kind.replace(/_/g, " ")}
          {application.org_name ? ` · ${application.org_name}` : ""}
        </p>
      </header>

      <section className="mt-6 rounded-2xl border border-sky-500/40 bg-sky-500/5 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-sky-300">
          Devin&apos;s recommendation
        </h2>
        <p className="mt-2 whitespace-pre-line text-sm text-sky-100">
          {application.vet_recommendation || "(no recommendation captured)"}
        </p>
        {application.vet_reasoning ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-sky-300">
              Read Devin&apos;s full reasoning
            </summary>
            <p className="mt-2 whitespace-pre-line text-sm text-sky-100/80">
              {application.vet_reasoning}
            </p>
          </details>
        ) : null}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Card title="Mission alignment">
          <p className="whitespace-pre-line text-sm text-zinc-300">
            {application.mission_statement}
          </p>
        </Card>
        <Card title="APA alignment">
          <p className="whitespace-pre-line text-sm text-zinc-300">
            {application.apa_statement}
          </p>
        </Card>
      </section>

      <ReviewForm
        applicationId={id}
        token={token}
        existingVote={myExisting?.vote}
        existingComment={myExisting?.comment}
        reviewerName={reviewer.name}
      />

      <p className="mt-6 text-xs text-zinc-500">
        Other trio votes:&nbsp;
        {application.reviews.length === 0
          ? "none yet"
          : application.reviews
              .map((r) => `${r.vote} (${r.reviewer_email.split("@")[0]})`)
              .join(" · ")}
      </p>

      <p className="mt-2 text-xs text-zinc-500">
        <Link
          href={`/applications/${id}`}
          className="text-fuchsia-300 underline"
        >
          Back to public status page
        </Link>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-10">{children}</main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Banner({
  tone,
  title,
  children,
}: {
  tone: "rose" | "amber";
  title: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "rose"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
      : "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return (
    <div className={`rounded-2xl border ${cls} p-6`}>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm">{children}</p>
    </div>
  );
}
