import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Office-hours file upload. The drag-and-drop zone in any agent chat with
 * the ``file_analysis`` capability POSTs here as multipart/form-data. We
 * stream the body straight to Vercel Blob so large datasets / PDFs don't
 * have to fit in our process memory; the resulting blob URL is then
 * passed to ``/api/files/analyze`` to actually run the analysis pass.
 *
 * No file-size cap by design (per product call). Storage cost scales
 * with usage; pruning is deferred until a real concern.
 *
 * Auth-gated. Without a session the endpoint 401s — never let an
 * unauthenticated caller stuff arbitrary content into the project's
 * blob store.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: "Sign in to upload files." },
      { status: 401 },
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "File uploads are not configured. Connect a Vercel Blob store to the project at https://vercel.com/freedom-thevrschool/sof-ai/stores → Create Blob.",
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'file' part." },
      { status: 400 },
    );
  }

  // Office-hours uploads land under a per-user/per-day folder so a
  // grader / admin can sweep a single user's submissions if needed.
  const userKey = (session.user.email ?? session.user.name ?? "anon")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `office-hours/${userKey}/${stamp}-${safeName}`;

  try {
    const blob = await put(path, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || "application/octet-stream",
    });
    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      name: file.name,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Vercel Blob upload failed.",
      },
      { status: 502 },
    );
  }
}
