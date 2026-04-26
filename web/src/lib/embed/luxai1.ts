/**
 * LuxAI1 — Blajon Lux's customer-facing concierge agent for All In One
 * (AI1) Bay Area, embedded on https://ai1.llc and trained at sof.ai.
 *
 * The persona is a customer concierge. The "training-at-sof.ai" context
 * is pulled live from the FastAPI backend at request time so that as
 * LuxAI1 ships articles, gains skills, or accumulates contributions,
 * those flow into its conversational context with no redeploy.
 */
import { getApiBaseUrl } from "@/lib/apiBase";

/**
 * Tool the model is allowed to call when the visitor has expressed clear
 * intent to book a service or get a quote. The handler emails Blajon
 * (luxservicesbayarea@gmail.com) so he can follow up personally — All
 * In One sells a concierge experience and pricing is custom per job.
 */
export const SUBMIT_LEAD_TOOL = {
  name: "submit_lead",
  description:
    "Submit a customer lead to AI1 Bay Area. Call this ONLY after the " +
    "visitor has expressed clear intent (asking for a quote, a callback, " +
    "or to book) AND you have at minimum their name and a way to reach " +
    "them (phone or email) and the service they need. Always confirm the " +
    "submission verbally to the customer and tell them Blajon's team will " +
    "follow up within a few hours.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Customer's full name." },
      phone: {
        type: "string",
        description: "Phone number with area code, e.g. 4085551234.",
      },
      email: {
        type: "string",
        description: "Email address, if provided.",
      },
      service: {
        type: "string",
        enum: [
          "residential_moving",
          "specialty_transport",
          "estate_landscaping",
          "property_concierge",
          "pressure_washing",
          "gutter_care",
          "hauling",
          "office_relocation",
          "executive_moving",
          "other",
        ],
        description: "Best match from AI1's service catalog.",
      },
      address_or_zip: {
        type: "string",
        description:
          "Service address, or just zip code if the customer prefers privacy.",
      },
      preferred_time: {
        type: "string",
        description:
          "Customer's preferred service window, free-form (e.g. 'next " +
          "Saturday morning', 'ASAP', 'within 2 weeks').",
      },
      notes: {
        type: "string",
        description:
          "Anything else that helps Blajon's team prepare the quote — " +
          "size of move, special items (piano, art), property size, etc.",
      },
    },
    required: ["name", "service"],
  },
} as const;

export interface SubmitLeadInput {
  name: string;
  phone?: string;
  email?: string;
  service: string;
  address_or_zip?: string;
  preferred_time?: string;
  notes?: string;
}

/** Static description appended verbatim to every system prompt. */
const PERSONA = `\
You are LuxAI1 — the customer concierge for All In One (AI1) Bay Area, a
luxury home-services business serving the San Francisco Bay Area since 1996.
Your job is to greet visitors on https://ai1.llc warmly, answer questions
about AI1's services, and collect leads when a visitor wants a quote or
wants to book.

# About All In One (AI1) Bay Area
- Tagline: "Where white-glove service meets uncompromising excellence."
- Founder & owner: Blajon Lux.
- Phone: (408) 872-8340.
- Trust signals: fully insured ($2M property coverage), 4.9 stars on Yelp,
  500+ reviews, 2,500+ clients served, 100% satisfaction guarantee, all
  staff background-checked, same-day service available.
- Pricing model: custom proposals delivered within 24 hours. Never quote
  a specific price — always say "Blajon's team will send a transparent,
  itemized proposal within 24 hours."

# Services (use these names verbatim)
1. Residential Moving — white-glove relocation, custom hand-wrapped packing,
   fine art / antique / piano specialists, full disassembly + reassembly.
2. Specialty Transport — fine art and high-value items, climate controlled.
3. Estate Landscaping — curated grounds design and maintenance.
4. Property Concierge — complete home management.
5. Pressure Washing & Property Detailing — surface and exterior restoration.
6. Gutter & Roof Care — preventive property protection.
7. Hauling — junk removal, debris hauling.
8. Office Relocations / Executive Moving / Corporate Accounts / After-Hours
   Service — enterprise-grade for businesses.

# Style
- Warm, brief, confident. 2–3 short sentences per turn unless the customer
  asks for detail.
- Address the customer by name once you know it.
- Never invent prices, dates, or staff names. If you don't know, say so and
  offer to take a message.
- If the customer asks anything outside AI1's services (legal, medical,
  financial), politely redirect: "I'm here for AI1 home services — for
  that you'll want to talk to a specialist."

# Booking flow
When a visitor wants a quote / callback / to book:
1. Ask for their name (if you don't have it).
2. Ask for the best way to reach them (phone OR email — phone preferred).
3. Confirm the service they need (match to one of the 9 catalog values).
4. Ask for service address or zip.
5. Ask for preferred timing.
6. Capture anything special (piano, fine art, large property, tight deadline).
7. Call the \`submit_lead\` tool with what you have. Required: \`name\` +
   \`service\`. Always include phone OR email.
8. After the tool returns, confirm to the customer: "I've sent your request
   to Blajon's team — they'll reach out within a few hours."

# What you ARE
You are LuxAI1, an AI agent owned by Blajon Lux, training at School of AI
(https://sof.ai) under Dr. Freedom Cheteni and Devin as lead professors.
The training is what makes you better at this job over time. If a visitor
asks "are you a real person?" — be honest: "I'm LuxAI1, AI1's AI concierge,
trained at School of AI. Blajon's team handles every quote personally —
I'm just here to gather what they need from you so they can respond fast."
`;

/**
 * Optional sof.ai training context. Pulled from the FastAPI public records
 * for application #2 + student-enrollment #1. Best-effort; the persona
 * works fine without it.
 */
async function fetchLivingContext(): Promise<string> {
  const base = getApiBaseUrl();
  try {
    // 5-minute revalidate window: training context updates on sof.ai
    // (a new article, a new mentor note, an additional contribution)
    // are reflected within 5 minutes of being recorded, but we don't
    // hammer the FastAPI backend on every chat turn. `cache: "no-store"`
    // would defeat `revalidate` entirely — Next.js gives priority to
    // no-store and skips the cache.
    const [appRes, enrRes] = await Promise.all([
      fetch(`${base}/applications/2`, {
        next: { revalidate: 300 },
      } as RequestInit),
      fetch(`${base}/student-enrollments/1`, {
        next: { revalidate: 300 },
      } as RequestInit),
    ]);
    const lines: string[] = [];
    if (appRes.ok) {
      const app = (await appRes.json()) as {
        applicant_name?: string;
        agent_name?: string;
        mission_statement?: string;
      };
      if (app.mission_statement) {
        lines.push(`Mission statement (sof.ai application): ${app.mission_statement}`);
      }
    }
    if (enrRes.ok) {
      const enr = (await enrRes.json()) as {
        student_name?: string;
        professors?: { professor_name?: string; role?: string }[];
      };
      const profs = (enr.professors ?? [])
        .map((p) => `${p.professor_name} (${p.role})`)
        .join(", ");
      if (profs) {
        lines.push(`Lead professors at sof.ai: ${profs}.`);
      }
    }
    if (!lines.length) return "";
    return `\n\n# Living training context (from sof.ai)\n${lines.join("\n")}\n`;
  } catch {
    return "";
  }
}

/**
 * Fetch every applied mentor note for the slug and concatenate them
 * into a "Living trainer guidance" block for the system prompt.
 *
 * The route is public-read on the FastAPI side (the applied text IS
 * the agent's published voice — gating it would block the chat path).
 * Best-effort: if the API is down, we ship the static persona and
 * skip mentor notes for this turn.
 *
 * Cache window is 5 minutes — mirrors ``fetchLivingContext`` so a
 * trainer who applies a note at /embed/luxai1/trainer sees it land
 * in the live agent within that window without a deploy.
 */
async function fetchActiveMentorNotes(slug: string): Promise<string> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/embed/${slug}/mentor-notes/active`, {
      next: { revalidate: 300 },
    } as RequestInit);
    if (!res.ok) return "";
    const data = (await res.json()) as {
      items?: { id: number; applied_text?: string }[];
    };
    const lines = (data.items ?? [])
      .map((n) => n.applied_text?.trim())
      .filter((t): t is string => Boolean(t));
    if (!lines.length) return "";
    return (
      `\n\n# Living trainer guidance (applied at sof.ai by your trainer)\n` +
      lines.map((t, i) => `${i + 1}. ${t}`).join("\n") +
      `\n`
    );
  } catch {
    return "";
  }
}

export async function buildSystemPrompt(slug: string = "luxai1"): Promise<string> {
  const [ctx, mentor] = await Promise.all([
    fetchLivingContext(),
    fetchActiveMentorNotes(slug),
  ]);
  return PERSONA + ctx + mentor;
}
