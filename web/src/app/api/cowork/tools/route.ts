import { NextResponse } from "next/server";
import { ALL_TOOLS } from "@/lib/cowork/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public-ish tool catalog. Returns the registered cowork tools, minus
 * the runner functions, so the chat UI can pre-render available actions
 * (e.g. "What can Claude do for me?" panel).
 */
export async function GET(): Promise<Response> {
  return NextResponse.json({
    tools: ALL_TOOLS.map((t) => ({
      id: t.id,
      service: t.service,
      action: t.action,
      description: t.description,
      mutating: t.mutating,
      params: t.params,
    })),
  });
}
