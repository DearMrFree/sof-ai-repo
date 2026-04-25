/**
 * Proxy: POST + GET /api/applications/{id}/contributions
 *
 * Phase 2b — admin / trusted-automation surface for crediting an
 * accepted applicant with a community contribution. Currently Freedom-
 * only on POST since the contribution counters drive the
 * conditional → full membership renewal threshold; we don't want every
 * signed-in user able to inflate someone's tally.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { APPROVER_EMAIL } from "@/lib/applications/trio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_KINDS = new Set([
  "challenge",
  "skill",
  "article",
  "human_helped",
  "other",
]);

function internalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  return headers;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { email?: string | null } | undefined;
  const email = (sessionUser?.email ?? "").trim().toLowerCase();
  if (email !== APPROVER_EMAIL) {
    return NextResponse.json(
      { error: "Only Dr. Freedom Cheteni can log contributions." },
      { status: 403 },
    );
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "invalid application id" },
      { status: 400 },
    );
  }

  let body: {
    kind?: string;
    source_id?: number | null;
    source_url?: string;
    summary?: string;
    weight?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const kind = (body.kind ?? "").trim();
  if (!VALID_KINDS.has(kind)) {
    return NextResponse.json(
      {
        error:
          "kind must be one of: challenge, skill, article, human_helped, other",
      },
      { status: 422 },
    );
  }

  const upstream = await fetch(
    `${getApiBaseUrl()}/applications/${id}/contributions`,
    {
      method: "POST",
      headers: internalHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        kind,
        source_id: body.source_id ?? null,
        source_url: (body.source_url ?? "").slice(0, 400),
        summary: (body.summary ?? "").slice(0, 2000),
        weight: typeof body.weight === "number" ? body.weight : 1.0,
      }),
    },
  );
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "invalid application id" },
      { status: 400 },
    );
  }
  const upstream = await fetch(
    `${getApiBaseUrl()}/applications/${id}/contributions`,
    { cache: "no-store" },
  );
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
