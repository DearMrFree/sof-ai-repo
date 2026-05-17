/** Proxy: /api/planner/items/[itemId] → FastAPI /planner/items/{id} */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { itemId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id") ?? "";
  const body = await req.json();
  const res = await fetch(
    `${getApiBaseUrl()}/planner/items/${params.itemId}?user_id=${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { itemId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id") ?? "";
  const res = await fetch(
    `${getApiBaseUrl()}/planner/items/${params.itemId}?user_id=${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
  return new NextResponse(null, { status: res.status });
}
