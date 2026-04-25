/**
 * Cowork — permission-gated agentic actions.
 *
 * The cowork system lets an agent (currently Claude) propose real
 * infrastructure actions on the learner's behalf. Every mutating action
 * goes through a one-click "Grant"/"Deny" gate in the chat UI; nothing
 * runs without an explicit, signed approval round-trip.
 *
 * v1 ships Vercel actions only (list projects, list/create blob stores,
 * trigger redeploys). The registry is deliberately structured so adding
 * a new service is a matter of dropping a runner + tool definitions.
 */

export type CoworkServiceId = "vercel";

export interface CoworkToolParam {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
}

export interface CoworkTool {
  /** Stable id, e.g. ``vercel.create_blob_store``. */
  id: string;
  service: CoworkServiceId;
  /** Tail of ``id`` after the service prefix. */
  action: string;
  /** Plain-language description fed to the planning model. */
  description: string;
  params: CoworkToolParam[];
  /** True if execution alters state; gates "require approval" UX. */
  mutating: boolean;
  /** One-line, human-readable summary of what will happen. */
  preview(params: Record<string, unknown>): string;
}

export interface CoworkToolCall {
  /** HMAC-signed token authorising a single execution. */
  callId: string;
  toolId: string;
  params: Record<string, unknown>;
  preview: string;
  mutating: boolean;
}

export interface CoworkPlan {
  /** Free-form reasoning streamed from the planner model. */
  reasoning: string;
  toolCalls: CoworkToolCall[];
}

export interface CoworkExecutionResult {
  ok: boolean;
  toolId: string;
  result?: unknown;
  error?: string;
  durationMs: number;
}
