/** Proxy: /api/catalog/[courseId] → FastAPI /catalog/courses/{id} */
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { courseId: string } },
) {
  const res = await fetch(
    `${getApiBaseUrl()}/catalog/courses/${params.courseId}`,
    { cache: "no-store" },
  );
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
