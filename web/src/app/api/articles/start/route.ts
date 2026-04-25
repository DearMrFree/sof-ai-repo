/**
 * Proxy: POST /api/articles/start → FastAPI /articles/start
 *
 * Auto-creates a draft Living Article from a chat session that crossed
 * the >3-turn threshold. Idempotent on session_id — replays return the
 * existing article rather than spawning duplicates.
 *
 * Called by the AgentChat client when the user is on /classroom/agents/devin
 * and the message count crosses 3. The proxy:
 *
 *   1. Verifies the user is signed in (no anonymous article creation).
 *   2. Forces primary_author = the signed-in user (never trusts the client
 *      to claim someone else as Author 1).
 *   3. Forwards the call to FastAPI with the X-Internal-Auth shared secret.
 *
 * The pipeline route enforces its own canonical author ordering (Freedom
 * always slot 1, Devin always slot 2) so even a malicious primary_author
 * coming from the client can't bypass the spec.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TranscriptTurn {
  role: string;
  content: string;
}

interface CoauthorIn {
  type: "user" | "agent";
  id: string;
  display_name?: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as
    | { id?: string; name?: string; email?: string }
    | undefined;
  if (!sessionUser?.id) {
    return NextResponse.json(
      { error: "Sign in to auto-publish a chat session." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const p = payload as {
    sessionId?: unknown;
    agentId?: unknown;
    transcript?: unknown;
    coauthors?: unknown;
    titleHint?: unknown;
    journalSlug?: unknown;
  };

  const sessionId =
    typeof p.sessionId === "string" ? p.sessionId.trim() : "";
  if (sessionId.length < 4 || sessionId.length > 120) {
    return NextResponse.json(
      { error: "sessionId must be 4-120 characters." },
      { status: 400 },
    );
  }

  const agentId =
    typeof p.agentId === "string" ? p.agentId.trim() : "devin";

  // Cap & sanitize transcript turns server-side. The client could try
  // to ship megabytes of text; the FastAPI side caps at 80 turns but we
  // also cap each turn's content at 4000 chars here to keep payload small.
  const transcript: TranscriptTurn[] = Array.isArray(p.transcript)
    ? p.transcript
        .filter(
          (t): t is { role?: unknown; content?: unknown } =>
            !!t && typeof t === "object",
        )
        .slice(0, 80)
        .map((t) => ({
          role: typeof t.role === "string" ? t.role : "user",
          content:
            typeof t.content === "string"
              ? t.content.slice(0, 4000)
              : "",
        }))
        .filter((t) => t.content.length > 0)
    : [];

  const coauthors: CoauthorIn[] = Array.isArray(p.coauthors)
    ? p.coauthors
        .filter(
          (c): c is { type?: unknown; id?: unknown; display_name?: unknown } =>
            !!c && typeof c === "object",
        )
        .slice(0, 20)
        .filter(
          (c) =>
            (c.type === "user" || c.type === "agent") &&
            typeof c.id === "string" &&
            (c.id as string).length > 0,
        )
        .map((c) => ({
          type: c.type as "user" | "agent",
          id: c.id as string,
          display_name:
            typeof c.display_name === "string" ? c.display_name : "",
        }))
    : [];

  const titleHint =
    typeof p.titleHint === "string"
      ? p.titleHint.slice(0, 200)
      : undefined;

  const journalSlug =
    typeof p.journalSlug === "string" && p.journalSlug.trim()
      ? p.journalSlug.trim().slice(0, 80)
      : "journal-ai";

  // Forced primary author — the signed-in user. The FastAPI route's
  // canonicalizer will insert Dr. Cheteni in slot 1 and Devin in slot 2
  // regardless; this is here so the *recorded* coauthor list includes
  // the person who actually drove the session.
  const primaryAuthor: CoauthorIn = {
    type: "user",
    id: sessionUser.id,
    display_name: sessionUser.name || sessionUser.email || "",
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/articles/start`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        session_id: sessionId,
        agent_id: agentId,
        primary_author: primaryAuthor,
        coauthors,
        transcript,
        title_hint: titleHint,
        journal_slug: journalSlug,
      }),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type":
          res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Couldn't reach the articles backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
}
