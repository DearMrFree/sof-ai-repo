import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LaunchRequest {
  programSlug: string;
  lessonSlug: string;
  prompt: string;
  repoHint?: string;
  title: string;
}

export async function POST(req: NextRequest) {
  let body: LaunchRequest;
  try {
    body = (await req.json()) as LaunchRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const apiKey = process.env.DEVIN_API_KEY;
  const enabled = process.env.DEVIN_TASKS_ENABLED === "true";

  // Real Devin API path (enabled when both flags are set).
  if (apiKey && enabled) {
    try {
      const res = await fetch("https://api.devin.ai/v1/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: body.prompt,
          idempotent: true,
          title: `sof.ai capstone: ${body.title}`,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { error: `Devin API returned ${res.status}: ${text}` },
          { status: 502 },
        );
      }
      const data = (await res.json()) as {
        session_id: string;
        url: string;
      };
      return NextResponse.json({
        sessionUrl: data.url,
        stub: false,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Failed to reach Devin API",
        },
        { status: 502 },
      );
    }
  }

  // Stubbed / demo path — shows how the UI will behave without burning real
  // Devin minutes. Flip DEVIN_TASKS_ENABLED=true and set DEVIN_API_KEY to go live.
  const fakeSessionId = `demo-${Date.now().toString(36)}-${body.lessonSlug}`;
  return NextResponse.json({
    sessionUrl: `https://app.devin.ai/sessions/${fakeSessionId}`,
    prUrl: `https://github.com/${body.repoHint ?? "DearMrFree/sof-ai-scratch"}/pull/1`,
    stub: true,
  });
}
