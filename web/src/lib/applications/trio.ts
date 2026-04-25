/**
 * Constants for the agent-onboarding steering trio.
 *
 * Mirrors the canonical list on the FastAPI side
 * (api/src/sof_ai_api/routes/applications.py::TRIO_REVIEWERS); we keep
 * a parallel copy here so the proxy can render reviewer names and gate
 * the admin UI without a backend round-trip.
 *
 * Membership change requires a code deploy on purpose.
 */

export interface TrioReviewer {
  email: string; // canonical lowercase
  name: string;
  short: string; // first-name greeting
}

export const TRIO: TrioReviewer[] = [
  {
    email: "freedom@thevrschool.org",
    name: "Dr. Freedom Cheteni",
    short: "Freedom",
  },
  {
    email: "gcorea@apa.org",
    name: "Garth Corea (APA)",
    short: "Garth",
  },
  {
    email: "ewojcicki@gmail.com",
    name: "Esther Wojcicki",
    short: "Esther",
  },
];

export const TRIO_EMAILS: Set<string> = new Set(TRIO.map((r) => r.email));

export function findTrioReviewer(email: string): TrioReviewer | null {
  const norm = email.trim().toLowerCase();
  return TRIO.find((r) => r.email === norm) ?? null;
}

export const APPROVER_EMAIL = "freedom@thevrschool.org";
