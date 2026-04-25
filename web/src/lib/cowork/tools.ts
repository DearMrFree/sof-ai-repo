import type { CoworkTool } from "./types";

/**
 * Registry of cowork tools. v1 = Vercel only.
 *
 * Each tool's ``description`` is fed verbatim to the planning model, so
 * write it as if briefing a careful junior engineer: explicit about what
 * the action does, when it's safe, and what the params mean.
 *
 * Anthropic tool names can't contain dots, so on the wire we encode the
 * id as ``vercel__create_blob_store``; the helpers below convert.
 */
export const VERCEL_TOOLS: CoworkTool[] = [
  {
    id: "vercel.list_projects",
    service: "vercel",
    action: "list_projects",
    description:
      "List Vercel projects available to the configured token. Read-only; safe to call without explicit approval.",
    params: [],
    mutating: false,
    preview: () => "List Vercel projects in the team.",
  },
  {
    id: "vercel.list_blob_stores",
    service: "vercel",
    action: "list_blob_stores",
    description:
      "List Vercel Blob storage stores in the team. Read-only; useful for confirming a store exists before creating a new one.",
    params: [],
    mutating: false,
    preview: () => "List Vercel Blob stores in the team.",
  },
  {
    id: "vercel.create_blob_store",
    service: "vercel",
    action: "create_blob_store",
    description:
      "Create a new Vercel Blob store. Requires `name` (lowercase letters, digits and dashes). On creation Vercel auto-generates a `BLOB_READ_WRITE_TOKEN` and connects the store to the active project.",
    params: [
      {
        name: "name",
        type: "string",
        description:
          "Store name. Must match `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`. Choose a memorable, project-prefixed name like `sof-ai-blob`.",
        required: true,
      },
    ],
    mutating: true,
    preview: (p) => `Create Vercel Blob store "${String(p.name)}".`,
  },
  {
    id: "vercel.redeploy_project",
    service: "vercel",
    action: "redeploy_project",
    description:
      "Trigger a fresh production deployment of a Vercel project by re-deploying its most recent production build. Useful after env-var changes.",
    params: [
      {
        name: "projectId",
        type: "string",
        description:
          "Vercel project id (e.g. `prj_xxLWkrjtKSPwIL3RZwtmVm5YYK2I`). Use `vercel.list_projects` first if unsure.",
        required: true,
      },
    ],
    mutating: true,
    preview: (p) => `Redeploy Vercel project ${String(p.projectId)} to production.`,
  },
];

export const ALL_TOOLS: CoworkTool[] = [...VERCEL_TOOLS];

export function getTool(id: string): CoworkTool | undefined {
  return ALL_TOOLS.find((t) => t.id === id);
}

/** Anthropic tool names can't contain ``.``; we use ``__`` on the wire. */
export function toWireName(toolId: string): string {
  return toolId.replace(/\./g, "__");
}

export function fromWireName(wire: string): string {
  return wire.replace(/__/g, ".");
}
