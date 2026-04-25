/**
 * POST /api/applications/{id}/review
 *
 * A trio reviewer (validated via HMAC-signed token) submits their
 * yes/no/maybe vote. The route:
 *   1. Verifies the token; rejects 401 on tamper / expiry / bad signature.
 *   2. Forwards the vote to FastAPI (which upserts on (app_id, email)).
 *   3. If three reviews now exist, runs Devin's synthesis call and
 *      hits FastAPI /finalize to flip the application to its terminal
 *      state.
 *
 * Multiple votes from the same reviewer are allowed — the upsert in
 * the API is the source of truth, and synthesis only fires once the
 * trio has all three rows.
 */
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBase";
import { verifyReviewToken } from "@/lib/applications/token";
import { synthesizeTrioVotes } from "@/lib/applications/vetting";
import { findTrioReviewer } from "@/lib/applications/trio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function internalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  return headers;
}

interface ReviewBody {
  token: string;
  vote: "yes" | "no" | "maybe";
  comment?: string;
}

export async function POST(
  req: Request,
  ctx: { params: { id: string } },
) {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "application id must be a positive integer." },
      { status: 400 },
    );
  }

  let body: ReviewBody;
  try {
    body = (await req.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (!body.token) {
    return NextResponse.json(
      { error: "Reviewer token is required." },
      { status: 401 },
    );
  }
  const claims = verifyReviewToken(body.token);
  if (!claims) {
    return NextResponse.json(
      { error: "Invalid or expired reviewer link. Ask Devin to re-send." },
      { status: 401 },
    );
  }
  if (claims.applicationId !== id) {
    return NextResponse.json(
      { error: "Reviewer link does not match this application." },
      { status: 401 },
    );
  }
  const reviewer = findTrioReviewer(claims.reviewerEmail);
  if (!reviewer) {
    return NextResponse.json(
      { error: "Reviewer is not on the steering trio." },
      { status: 403 },
    );
  }
  if (!["yes", "no", "maybe"].includes(body.vote)) {
    return NextResponse.json(
      { error: "Vote must be 'yes', 'no', or 'maybe'." },
      { status: 400 },
    );
  }

  // Forward to FastAPI.
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}/applications/${id}/review`, {
      method: "POST",
      headers: internalHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        reviewer_email: reviewer.email,
        vote: body.vote,
        comment: (body.comment ?? "").slice(0, 4000),
      }),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Couldn't reach the applications backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
  const text = await res.text();
  if (!res.ok) {
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const detail = JSON.parse(text) as {
    id: number;
    status: string;
    applicant_name: string;
    agent_name: string;
    mission_statement: string;
    reviews: Array<{
      reviewer_email: string;
      reviewer_name: string;
      vote: "yes" | "no" | "maybe";
      comment: string;
    }>;
  };

  // If the trio is complete and we're still in trio_reviewing, run
  // Devin's synthesis call now and finalize.
  if (
    detail.status === "trio_reviewing" &&
    detail.reviews.length === 3 &&
    new Set(detail.reviews.map((r) => r.reviewer_email.toLowerCase())).size === 3
  ) {
    try {
      const synth = await synthesizeTrioVotes({
        applicantName: detail.applicant_name,
        agentName: detail.agent_name,
        missionStatement: detail.mission_statement,
        votes: detail.reviews.map((r) => ({
          reviewer_name: r.reviewer_name,
          reviewer_email: r.reviewer_email,
          vote: r.vote,
          comment: r.comment,
        })),
      });
      await fetch(`${getApiBaseUrl()}/applications/${id}/finalize`, {
        method: "POST",
        headers: internalHeaders(),
        cache: "no-store",
        body: JSON.stringify({
          final_decision: synth.final_decision,
          final_reasoning: synth.final_reasoning,
        }),
      });
    } catch (err) {
      // Synthesis failed — leave the application in trio_reviewing so
      // an admin can re-run /finalize manually. Don't fail the user's
      // vote submission.
      // eslint-disable-next-line no-console
      console.error("[applications/review] synthesis failed:", err);
    }
  }

  // Re-fetch latest detail (may have flipped to conditionally_accepted).
  try {
    const refreshed = await fetch(`${getApiBaseUrl()}/applications/${id}`, {
      cache: "no-store",
    });
    return new NextResponse(await refreshed.text(), {
      status: refreshed.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
