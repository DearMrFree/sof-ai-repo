import { promises as fs } from "fs";

/**
 * Best-effort audit log for cowork executions.
 *
 * Vercel serverless functions don't have persistent disk, but ``/tmp``
 * lives for the lambda instance's lifetime and the records are also
 * written to ``console.info`` so they show up in Vercel's log drains.
 * v2 will write to the FastAPI backend (see ``api/.../routes``); for
 * v1 a JSONL trail in /tmp + structured server logs is enough to
 * reconstruct what happened.
 */

const LOG_PATH = process.env.COWORK_AUDIT_PATH || "/tmp/cowork-audit.log";

export interface AuditRecord {
  ts: string;
  userId: string;
  toolId: string;
  params: Record<string, unknown>;
  ok: boolean;
  error?: string;
  durationMs: number;
}

export async function recordAudit(rec: AuditRecord): Promise<void> {
  // Always log structured. The console line is the durable record;
  // the file is a convenience for local debugging.
  // eslint-disable-next-line no-console
  console.info("[cowork.audit]", JSON.stringify(rec));
  try {
    await fs.appendFile(LOG_PATH, JSON.stringify(rec) + "\n", { encoding: "utf8" });
  } catch {
    // best-effort; never crash the caller
  }
}
