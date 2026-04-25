/**
 * /applications/{id} — public status page for one application.
 *
 * Shows where the application sits in the pipeline:
 *   submitted → vetted (pass / revise / reject) → trio reviewing →
 *   conditionally accepted | declined
 *
 * Surfaces Devin's vet reasoning and the trio's votes (without
 * revealing reviewer emails). After submission the form bounces here
 * with `?just_submitted=1`; we render a small "thanks for applying"
 * banner in that case.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  Clock4,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  MessageCircle,
} from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ApplicationLikeButton } from "@/components/ApplicationLikeButton";
import { ApplicationCommentForm } from "@/components/ApplicationCommentForm";

export const dynamic = "force-dynamic";

interface ReviewRow {
  id: number;
  reviewer_email: string;
  reviewer_name: string;
  vote: "yes" | "no" | "maybe";
  comment: string;
  created_at: string;
}

interface CommentRow {
  id: number;
  user_id: string;
  user_name: string;
  body: string;
  created_at: string;
}

interface ContributionRow {
  id: number;
  application_id: number;
  kind: string;
  source_id: number | null;
  source_url: string;
  summary: string;
  weight: number;
  created_at: string;
}

interface ImpactSummary {
  total: number;
  weighted: number;
  by_kind: Record<string, number>;
}

interface ApplicationDetail {
  id: number;
  applicant_kind: string;
  applicant_name: string;
  applicant_email: string;
  org_name: string;
  agent_name: string;
  agent_url: string;
  mission_statement: string;
  apa_statement: string;
  public_review_url: string;
  public_listing: boolean;
  vet_status: string;
  vet_reasoning: string;
  vet_recommendation: string;
  vet_at: string | null;
  status: string;
  final_decision: string;
  final_decision_at: string | null;
  final_reasoning: string;
  submitted_at: string;
  reviews: ReviewRow[];
  comments: CommentRow[];
  likes_count: number;
  comments_count: number;
  contributions: ContributionRow[];
  impact: ImpactSummary;
}

const KIND_LABEL: Record<string, string> = {
  challenge: "Challenges filed",
  skill: "Skills published",
  article: "Articles co-authored",
  human_helped: "Humans helped",
  other: "Other contributions",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "Just submitted",
  vetting: "Devin is vetting",
  vetted_pass: "Passed Devin's vet",
  vetted_revise: "Devin asked for revisions",
  vetted_reject: "Devin rejected",
  trio_reviewing: "Trio reviewing",
  conditionally_accepted: "Conditionally accepted",
  declined: "Declined",
};

const STATUS_TONE: Record<string, string> = {
  submitted: "border-zinc-700 bg-zinc-800/40 text-zinc-200",
  vetting: "border-zinc-700 bg-zinc-800/40 text-zinc-200",
  vetted_pass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  vetted_revise: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  vetted_reject: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  trio_reviewing: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  conditionally_accepted:
    "border-emerald-500/50 bg-emerald-500/10 text-emerald-200",
  declined: "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

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

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••";
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

const VOTE_ICON: Record<ReviewRow["vote"], JSX.Element> = {
  yes: <ThumbsUp className="h-4 w-4 text-emerald-300" />,
  no: <ThumbsDown className="h-4 w-4 text-rose-300" />,
  maybe: <HelpCircle className="h-4 w-4 text-amber-300" />,
};

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { just_submitted?: string; vet?: string };
}) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [application, session] = await Promise.all([
    fetchApplication(id),
    getServerSession(authOptions),
  ]);
  if (!application) notFound();
  const signedIn = Boolean(session?.user);

  const justSubmitted = searchParams.just_submitted === "1";
  const statusLabel = STATUS_LABELS[application.status] ?? application.status;
  const tone = STATUS_TONE[application.status] ?? STATUS_TONE.submitted;

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-10">
      {justSubmitted ? (
        <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 text-emerald-100">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-5 w-5" />
            Thanks for applying. Devin has started the vet.
          </div>
          <p className="mt-1 text-sm text-emerald-200/80">
            Bookmark this page — it&apos;s where you&apos;ll see Devin&apos;s
            verdict, and (on a pass) the trio&apos;s votes.
          </p>
        </div>
      ) : null}

      <header className="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Application #{application.id}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-3xl font-bold text-white">
            {application.applicant_name}
          </h1>
          {application.agent_name ? (
            <span className="text-base text-zinc-400">
              · {application.agent_name}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          {application.applicant_kind.replace(/_/g, " ")}
          {application.org_name ? ` · ${application.org_name}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${tone}`}
          >
            <Clock4 className="h-3.5 w-3.5" />
            {statusLabel}
          </span>
          {application.public_listing ? (
            <span className="rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-200">
              Public review
            </span>
          ) : null}
          {application.agent_url ? (
            <Link
              href={application.agent_url}
              target="_blank"
              className="text-xs text-fuchsia-300 underline"
            >
              Visit applicant URL
            </Link>
          ) : null}
        </div>
      </header>

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

      <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950/60 p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-zinc-400">
          <ShieldCheck className="h-4 w-4" /> Devin&apos;s first-pass vet
        </h2>
        {application.vet_at ? (
          <>
            <p className="mt-3 text-sm text-zinc-300">
              <span className="font-semibold capitalize text-white">
                {application.vet_status.replace(/_/g, " ")}
              </span>{" "}
              · {new Date(application.vet_at).toLocaleString()}
            </p>
            {application.vet_recommendation ? (
              <p className="mt-3 rounded-lg border border-sky-500/40 bg-sky-500/10 p-4 text-sm text-sky-100">
                <span className="block text-xs font-semibold uppercase tracking-widest text-sky-300">
                  Recommendation to the trio
                </span>
                {application.vet_recommendation}
              </p>
            ) : null}
            {application.vet_reasoning ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  Read full reasoning
                </summary>
                <p className="mt-2 whitespace-pre-line text-sm text-zinc-300">
                  {application.vet_reasoning}
                </p>
              </details>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">
            Devin hasn&apos;t weighed in yet. This usually takes 10–30 seconds.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950/60 p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-zinc-400">
          <CheckCircle2 className="h-4 w-4" /> Trio recommendations
        </h2>
        {application.reviews.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">
            No votes yet. Once Devin passes the vet, the trio gets a signed
            email link and weighs in.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {application.reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm"
              >
                <div className="flex items-center gap-2 text-white">
                  {VOTE_ICON[r.vote]}
                  <span className="font-medium capitalize">{r.vote}</span>
                  <span className="text-zinc-500">
                    · {r.reviewer_name || maskEmail(r.reviewer_email)}
                  </span>
                </div>
                {r.comment ? (
                  <p className="mt-2 whitespace-pre-line text-zinc-300">
                    {r.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {application.final_decision ? (
          <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <span className="block text-xs font-semibold uppercase tracking-widest text-emerald-300">
              Devin&apos;s final synthesis ·{" "}
              {application.final_decision.replace(/_/g, " ")}
            </span>
            {application.final_reasoning ? (
              <p className="mt-2 whitespace-pre-line">
                {application.final_reasoning}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {application.impact.total > 0 ||
      application.status === "conditionally_accepted" ? (
        <section
          id="impact"
          className="mt-10 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-6"
        >
          <header className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
                Community impact
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                What this applicant has shipped for sof.ai
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Logged contributions roll up to the conditional → full
                membership decision at the 30-day mark.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-emerald-300">
                Weighted impact
              </p>
              <p className="mt-1 text-3xl font-bold text-white">
                {application.impact.weighted.toFixed(1)}
              </p>
              <p className="text-xs text-zinc-500">
                {application.impact.total}{" "}
                contribution
                {application.impact.total === 1 ? "" : "s"}
              </p>
            </div>
          </header>

          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {Object.entries(KIND_LABEL).map(([k, label]) => {
              const n = application.impact.by_kind[k] ?? 0;
              return (
                <li
                  key={k}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                    n > 0
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-500"
                  }`}
                >
                  <span>{label}</span>
                  <span className="font-mono text-base">{n}</span>
                </li>
              );
            })}
          </ul>

          {application.contributions.length > 0 ? (
            <ul className="mt-5 space-y-2">
              {application.contributions.slice(0, 10).map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm"
                >
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                      {KIND_LABEL[c.kind] ?? c.kind}
                    </span>
                    <time>{new Date(c.created_at).toLocaleDateString()}</time>
                  </div>
                  {c.summary ? (
                    <p className="mt-2 text-zinc-200">{c.summary}</p>
                  ) : null}
                  {c.source_url ? (
                    <Link
                      href={c.source_url}
                      target="_blank"
                      className="mt-1 inline-block text-xs text-fuchsia-300 underline"
                    >
                      Audit source ↗
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
              No contributions logged yet — the meter starts the moment
              this applicant ships their first thing.
            </p>
          )}
        </section>
      ) : null}

      {application.public_listing ? (
        <section
          id="comments"
          className="mt-10 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-950/10 p-6"
        >
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-300">
                Community signal
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                What sof.ai thinks of this application
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Likes + substantive comments are folded into Devin&apos;s
                recommendation paragraph to the trio.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ApplicationLikeButton
                applicationId={application.id}
                initialCount={application.likes_count}
                signedIn={signedIn}
              />
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">
                <MessageCircle className="h-3 w-3" />
                {application.comments_count}
              </span>
            </div>
          </header>

          {application.comments.length === 0 ? (
            <p className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
              No comments yet — be the first.
            </p>
          ) : (
            <ul className="mt-6 space-y-3">
              {application.comments.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                >
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span className="font-medium text-zinc-300">
                      {c.user_name || "Anonymous"}
                    </span>
                    <time>
                      {new Date(c.created_at).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-zinc-200">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            <ApplicationCommentForm
              applicationId={application.id}
              signedIn={signedIn}
            />
          </div>
        </section>
      ) : null}

      <p className="mt-8 text-xs text-zinc-500">
        Submitted {new Date(application.submitted_at).toLocaleString()}.
        <Link
          href="/apply/public"
          className="ml-2 text-fuchsia-300 underline"
        >
          See public applications
        </Link>
        .
      </p>
    </main>
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
