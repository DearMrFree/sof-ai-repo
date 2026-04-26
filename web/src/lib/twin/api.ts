/** Server-side helpers for digital-twin reads (PR-TWIN). */
import { getApiBaseUrl } from "@/lib/apiBase";

export interface TwinSkill {
  id: number;
  user_profile_id: number;
  handle: string;
  proposed_at: string;
  status: "pending" | "reviewing" | "applied" | "rejected" | "retracted";
  title: string;
  proposed_text: string;
  applied_text: string;
  applied_at: string | null;
  reviewer_chain: {
    reviewer_id: string;
    verdict: string;
    summary: string;
    body: string;
    recorded_at: string;
  }[];
  rejection_reason: string;
}

export interface TwinSummary {
  handle: string;
  display_name: string;
  user_type: string;
  twin_name: string;
  twin_emoji: string;
  twin_persona_seed: string;
  goals: string[];
  strengths: string[];
  first_project: string;
  applied_skills: TwinSkill[];
}

function internalHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (process.env.INTERNAL_API_KEY) {
    h["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  return h;
}

/** Fetch the public twin summary for ``handle`` from FastAPI.
 *
 * Returns ``null`` on 404 (handle not in UserProfile yet — e.g. a static
 * registry person who never completed /welcome) or on network failure.
 * 4-second timeout matches the /admin seed endpoint so a slow Fly cold
 * start can't block /u/{handle} server-rendering.
 */
export async function fetchTwinSummary(
  handle: string,
): Promise<TwinSummary | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/twins/by-handle/${encodeURIComponent(
        handle.toLowerCase(),
      )}`,
      { cache: "no-store", signal: ctrl.signal },
    );
    if (!res.ok) return null;
    return (await res.json()) as TwinSummary;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Fetch the FULL skill list (every status except retracted) for owner UI.
 *
 * Public read on FastAPI; we proxy here so the page server-component
 * can render owner-only state on first paint without a client roundtrip.
 */
export async function fetchTwinSkills(handle: string): Promise<TwinSkill[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/twins/by-handle/${encodeURIComponent(
        handle.toLowerCase(),
      )}/skills`,
      { cache: "no-store", signal: ctrl.signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items: TwinSkill[] };
    return data.items ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

/** Internal-auth call to GET /users/by-handle so the page can compare
 * the profile owner's email against the current session — needed because
 * the public twin summary intentionally strips email (least-exposure).
 */
export async function fetchOwnerEmail(handle: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/users/by-handle/${encodeURIComponent(
        handle.toLowerCase(),
      )}`,
      { cache: "no-store", signal: ctrl.signal, headers: internalHeaders() },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return (data.email ?? "").toLowerCase() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
