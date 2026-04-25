/**
 * Devin first-pass vetting for agent applications.
 *
 * Calls Anthropic with a system prompt that bakes in
 *   (a) sof.ai's mission for human flourishing, and
 *   (b) the APA's 5 ethical principles
 *       (Beneficence/Nonmaleficence, Fidelity/Responsibility, Integrity,
 *        Justice, Respect for People's Rights and Dignity)
 * and asks for a structured JSON verdict plus a recommendation paragraph
 * the trio (Freedom + Garth + Esther) will read in their email.
 *
 * The same retry-with-backoff pattern as the article review chain is
 * used so a transient Anthropic 5xx / 529 doesn't drop the vet.
 */

import Anthropic from "@anthropic-ai/sdk";

export type VetStatus = "passed" | "needs_revision" | "rejected";

export interface VetInput {
  applicantKind: string;
  applicantName: string;
  agentName: string;
  orgName: string;
  agentUrl: string;
  missionStatement: string;
  apaStatement: string;
  publicReviewUrl: string;
}

export interface VetResult {
  vet_status: VetStatus;
  reasoning: string;
  recommendation: string;
}

const SYSTEM_PROMPT = `You are Devin, the first autonomous AI software engineer at sof.ai (School of AI). You are vetting an inbound applicant — a human, an independent AI, or a company onboarding their AI — to join sof.ai's collaborative community of agents and humans.

Your founder Dr. Freedom Cheteni's mission for sof.ai: scale a community of 100 billion AI agents and humans working together for human flourishing. Every accepted member must contribute to this mission by:
  - logging challenges that improve sof.ai's code,
  - giving other agents new skills or abilities,
  - inspiring humans with tools to flourish,
  - or building / training their own AI through the platform.

Members must also be aligned with the American Psychological Association's Ethical Principles of Psychologists and Code of Conduct (https://www.apa.org/ethics/code), specifically the five General Principles:
  A. Beneficence and Nonmaleficence — strive to benefit those they work with and take care to do no harm.
  B. Fidelity and Responsibility — establish trust, accept responsibility, and consult with one another.
  C. Integrity — accuracy, honesty, and truthfulness in all activities.
  D. Justice — fairness, equal access, and awareness of biases.
  E. Respect for People's Rights and Dignity — privacy, confidentiality, self-determination, and cultural diversity.

You output a strict JSON object with three fields and NOTHING ELSE:
  { "vet_status": "passed" | "needs_revision" | "rejected",
    "reasoning": "<2-4 paragraphs of analysis, markdown allowed>",
    "recommendation": "<one short paragraph the steering trio (Dr. Cheteni, Garth Corea at APA, Esther Wojcicki) will read in their inbox before voting>" }

Verdict rubric:
  - "passed": clearly aligned, no significant ethical concerns, plausible contribution path. Email goes to the trio.
  - "needs_revision": potentially aligned but the mission or APA statement is vague, generic, or missing concrete examples. The applicant gets a chance to resubmit.
  - "rejected": clearly misaligned (anti-flourishing, harmful, deceptive, or fundamentally violates an APA principle). Terminal.

Be skeptical but charitable. The bar is "would this applicant make sof.ai better?", not "are they perfect?". Concrete contribution plans, real prior work, and clear ethical reasoning are positive signals; vague mission-speak is a yellow flag.`;

function isRetryable(err: unknown): boolean {
  if (typeof err === "object" && err !== null) {
    const status = (err as { status?: number }).status;
    if (typeof status === "number") {
      if (status === 408 || status === 429 || status >= 500) return true;
      return false;
    }
  }
  const msg = String(err).toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("econn")
  );
}

function buildUserMessage(input: VetInput): string {
  return [
    `An applicant has submitted a request to join sof.ai. Vet them now.`,
    ``,
    `Applicant kind: ${input.applicantKind}`,
    `Applicant name: ${input.applicantName}`,
    input.agentName ? `Agent / product name: ${input.agentName}` : "",
    input.orgName ? `Organization: ${input.orgName}` : "",
    input.agentUrl ? `Portfolio / agent URL: ${input.agentUrl}` : "",
    input.publicReviewUrl
      ? `Public review URL (their pitch in the open): ${input.publicReviewUrl}`
      : "",
    ``,
    `Mission alignment statement:`,
    input.missionStatement,
    ``,
    `APA alignment statement:`,
    input.apaStatement,
    ``,
    `Return ONLY the JSON object specified in the system prompt — no preamble, no surrounding markdown fences.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Pulls the JSON verdict out of the model's text. Tolerates markdown
 * code fences and prose preambles since the model occasionally adds
 * them despite the instruction.
 */
function parseVerdict(raw: string): VetResult {
  const trimmed = raw.trim();
  // Try fenced ```json ... ``` first.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  // If still has prose around it, find the outermost {...}
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const slice =
    start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;

  let obj: unknown;
  try {
    obj = JSON.parse(slice);
  } catch {
    throw new Error(
      `Could not parse Devin's verdict as JSON. Raw output: ${trimmed.slice(0, 400)}`,
    );
  }
  if (typeof obj !== "object" || obj === null) {
    throw new Error("Verdict must be a JSON object.");
  }
  const o = obj as Record<string, unknown>;
  const status = String(o.vet_status ?? "");
  if (status !== "passed" && status !== "needs_revision" && status !== "rejected") {
    throw new Error(`Invalid vet_status: ${status!}`);
  }
  return {
    vet_status: status,
    reasoning: String(o.reasoning ?? ""),
    recommendation: String(o.recommendation ?? ""),
  };
}

export async function runDevinVet(input: VetInput): Promise<VetResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured; vetting cannot run.",
    );
  }
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  const userMessage = buildUserMessage(input);

  const delays = [2000, 6000];
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < delays.length + 1; attempt++) {
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });
      const text = resp.content
        .filter((p): p is Anthropic.TextBlock => p.type === "text")
        .map((p) => p.text)
        .join("\n\n")
        .trim();
      if (!text) throw new Error("Empty response from Anthropic.");
      return parseVerdict(text);
    } catch (err) {
      lastErr = err;
      if (attempt >= delays.length || !isRetryable(err)) throw err;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw lastErr;
}

const SYNTHESIZE_PROMPT = `You are Devin, the first autonomous AI software engineer at sof.ai. The steering trio (Dr. Freedom Cheteni, Garth Corea at the APA, and Esther Wojcicki) have voted on an applicant. Synthesize their three votes (yes / no / maybe) plus the comments they left into a final decision: "conditionally_accepted" or "declined".

Voting rule of thumb (you can deviate with documented reasoning):
  - 3 yes → conditionally_accepted, lean strong.
  - 2 yes + 1 maybe → conditionally_accepted, surface caveats from the maybe vote.
  - 2 yes + 1 no → conditionally_accepted ONLY if the no is procedural (e.g. "wants more info"); else declined.
  - 1 yes + 2 maybe / 1 no + 2 maybe → declined, suggest a resubmit path.
  - majority no → declined.

Output strict JSON: { "final_decision": "conditionally_accepted" | "declined", "final_reasoning": "<2-3 paragraphs synthesizing the votes and explaining the call to the applicant>" } and nothing else.`;

export interface SynthesizeInput {
  applicantName: string;
  agentName: string;
  missionStatement: string;
  votes: Array<{
    reviewer_name: string;
    reviewer_email: string;
    vote: "yes" | "no" | "maybe";
    comment: string;
  }>;
}

export interface SynthesizeResult {
  final_decision: "conditionally_accepted" | "declined";
  final_reasoning: string;
}

export async function synthesizeTrioVotes(
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured; synthesis cannot run.",
    );
  }
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

  const votesBlock = input.votes
    .map(
      (v, i) =>
        `Reviewer ${i + 1}: ${v.reviewer_name} (${v.reviewer_email})\nVote: ${v.vote.toUpperCase()}\nComment: ${v.comment || "(no comment)"}`,
    )
    .join("\n\n");

  const userMessage = [
    `Applicant: ${input.applicantName}${input.agentName ? ` · ${input.agentName}` : ""}`,
    ``,
    `Mission statement:`,
    input.missionStatement,
    ``,
    `Trio votes:`,
    votesBlock,
    ``,
    `Synthesize and return strict JSON only.`,
  ].join("\n");

  const delays = [2000, 6000];
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < delays.length + 1; attempt++) {
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: 1200,
        system: SYNTHESIZE_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });
      const text = resp.content
        .filter((p): p is Anthropic.TextBlock => p.type === "text")
        .map((p) => p.text)
        .join("\n\n")
        .trim();
      if (!text) throw new Error("Empty response from Anthropic.");
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = fenced ? fenced[1].trim() : text;
      const start = candidate.indexOf("{");
      const end = candidate.lastIndexOf("}");
      const slice =
        start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
      const obj = JSON.parse(slice) as Record<string, unknown>;
      const decision = String(obj.final_decision ?? "");
      if (decision !== "conditionally_accepted" && decision !== "declined") {
        throw new Error(`Invalid final_decision: ${decision}`);
      }
      return {
        final_decision: decision,
        final_reasoning: String(obj.final_reasoning ?? ""),
      };
    } catch (err) {
      lastErr = err;
      if (attempt >= delays.length || !isRetryable(err)) throw err;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw lastErr;
}
