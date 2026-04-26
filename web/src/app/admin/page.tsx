/**
 * /admin — real-time admin dashboard.
 *
 * Server-component-gated to administrators (per `isAdmin`). Non-admins
 * are redirected to /signin (if anonymous) or /u (if signed in but not
 * admin). The dashboard streams new-signup events via SSE through
 * `/api/admin/stream` and renders:
 *
 *   - 6 per-type live count cards (the same audiences as /welcome)
 *   - Total user count + active subscriber pulse
 *   - "Latest signups" feed (newest 20, prepended in real-time)
 */
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { isAdmin } from "@/lib/admin";
import { AdminDashboard, type AdminSeedSignup } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RecentResponse {
  items: Array<{
    id: number;
    handle: string;
    display_name: string;
    user_type: string;
    tagline: string;
    twin_name: string;
    twin_emoji: string;
    created_at: string;
    updated_at: string;
  }>;
  total: number;
  counts_by_type: Record<string, number>;
}

async function fetchSeed(): Promise<RecentResponse | null> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  // 4s timeout so /admin doesn't hang if Fly is slow/down — the page
  // still renders with empty seed and the SSE stream populates it once
  // the upstream comes back.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/users/admin/recent?limit=20`,
      { headers, cache: "no-store", signal: ctrl.signal },
    );
    if (!res.ok) return null;
    return (await res.json()) as RecentResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!email) {
    redirect("/signin?callbackUrl=/admin");
  }
  if (!(await isAdmin(email))) {
    // Not an admin → bounce to their profile (or onboarding if they
    // haven't picked a handle yet). /welcome will redirect home if they
    // already have a profile, so this is safe for both states.
    redirect("/welcome");
  }

  const seed = await fetchSeed();
  const initial: AdminSeedSignup[] = (seed?.items ?? []).map((it) => ({
    id: it.id,
    handle: it.handle,
    display_name: it.display_name,
    user_type: it.user_type,
    tagline: it.tagline,
    twin_name: it.twin_name,
    twin_emoji: it.twin_emoji,
    created_at: it.created_at,
  }));
  const counts = seed?.counts_by_type ?? {
    student: 0,
    educator: 0,
    corporation: 0,
    administrator: 0,
    researcher: 0,
    founder: 0,
  };
  const total = seed?.total ?? 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <AdminDashboard
        initial={initial}
        initialCounts={counts}
        initialTotal={total}
        upstreamReachable={seed !== null}
      />
    </main>
  );
}
