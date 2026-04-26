/**
 * /api/users
 *
 * GET — list profiles (for the searchable directory on /u). Public:
 * everything in the response is already public on profile pages.
 */
import { NextResponse, type NextRequest } from "next/server";

import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
// Cache for ~30s — the directory page should feel near-real-time but
// doesn't need to roundtrip on every keypress. Search/filter happens
// client-side on the cached set.
export const revalidate = 30;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = new URLSearchParams();
  const t = url.searchParams.get("type");
  const q = url.searchParams.get("q");
  if (t) params.set("type", t);
  if (q) params.set("q", q);
  const limit = url.searchParams.get("limit") ?? "200";
  params.set("limit", limit);

  const upstream = `${getApiBaseUrl()}/users?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(upstream, {
      cache: "no-store",
    });
  } catch (err) {
    // Soft-fail: the directory falls back to static registries when this
    // call fails, so a 5xx here just means "no dynamic users to add".
    return NextResponse.json(
      { items: [], total: 0, counts_by_type: {}, error: String(err) },
      { status: 200 },
    );
  }

  const json = await res.json().catch(() => ({
    items: [],
    total: 0,
    counts_by_type: {},
  }));
  return NextResponse.json(json, { status: res.status });
}
