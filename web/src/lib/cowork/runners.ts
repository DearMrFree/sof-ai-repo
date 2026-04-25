/**
 * Cowork action runners.
 *
 * The execute endpoint dispatches to ``runTool``; this file contains
 * the actual side-effecting calls. Runners must throw on error (the
 * caller wraps the throw into an audited failure). Read-only runners
 * return JSON-serializable plain objects; mutating runners return the
 * minimal "what got created" shape so the chat can surface it.
 *
 * Auth: the server uses its own ``VERCEL_TOKEN`` (set as a Vercel
 * project env var). v2 will let users bring their own token, stored
 * encrypted in the user profile.
 */

const VERCEL_API = "https://api.vercel.com";

interface VercelEnv {
  token: string;
  teamId?: string;
}

function getVercelEnv(): VercelEnv | null {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return null;
  const teamId = process.env.VERCEL_TEAM_ID || undefined;
  return { token, teamId };
}

async function vercelFetch(
  env: VercelEnv,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = new URL(`${VERCEL_API}${path}`);
  if (env.teamId && !url.searchParams.has("teamId")) {
    url.searchParams.set("teamId", env.teamId);
  }
  return fetch(url.toString(), {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${env.token}`,
      "Content-Type": "application/json",
    },
  });
}

async function expectOk(res: Response, label: string): Promise<unknown> {
  if (res.ok) return res.json();
  const body = await res.text();
  throw new Error(`${label}: HTTP ${res.status} — ${body.slice(0, 400)}`);
}

interface VercelProjectShape {
  id?: string;
  name?: string;
}

interface VercelStoreShape {
  id?: string;
  name?: string;
  type?: string;
  status?: string;
}

interface VercelDeploymentShape {
  uid?: string;
  url?: string;
  name?: string;
  readyState?: string;
}

async function runVercelTool(
  action: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const env = getVercelEnv();
  if (!env) {
    throw new Error(
      "VERCEL_TOKEN is not configured on the server. Add it as a project env var to enable Vercel cowork actions.",
    );
  }

  switch (action) {
    case "list_projects": {
      const data = (await expectOk(
        await vercelFetch(env, "/v9/projects?limit=20"),
        "Vercel list_projects",
      )) as { projects?: VercelProjectShape[] };
      return (data.projects ?? []).map((p) => ({ id: p.id, name: p.name }));
    }
    case "list_blob_stores": {
      const data = (await expectOk(
        await vercelFetch(env, "/v1/storage/stores"),
        "Vercel list_blob_stores",
      )) as { stores?: VercelStoreShape[] };
      return (data.stores ?? [])
        .filter((s) => s.type === "blob")
        .map((s) => ({ id: s.id, name: s.name, status: s.status }));
    }
    case "create_blob_store": {
      const name = String(params.name ?? "");
      if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(name)) {
        throw new Error(
          "Invalid store name. Use lowercase letters, digits and dashes; 3-64 chars; no leading/trailing dash.",
        );
      }
      const data = (await expectOk(
        await vercelFetch(env, "/v1/storage/stores/blob", {
          method: "POST",
          body: JSON.stringify({ name }),
        }),
        "Vercel create_blob_store",
      )) as { store?: VercelStoreShape };
      const store = data.store ?? {};
      return { id: store.id, name: store.name, status: store.status };
    }
    case "redeploy_project": {
      const projectId = String(params.projectId ?? "");
      if (!projectId) throw new Error("Missing projectId.");
      const list = (await expectOk(
        await vercelFetch(
          env,
          `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=1&target=production&state=READY`,
        ),
        "Vercel deployments lookup",
      )) as { deployments?: VercelDeploymentShape[] };
      const last = list.deployments?.[0];
      if (!last?.uid) {
        throw new Error("No prior production deployment to clone.");
      }
      const data = (await expectOk(
        await vercelFetch(env, "/v13/deployments", {
          method: "POST",
          body: JSON.stringify({
            name: last.name ?? "redeploy",
            deploymentId: last.uid,
            target: "production",
          }),
        }),
        "Vercel redeploy",
      )) as { id?: string; url?: string; readyState?: string };
      return { id: data.id, url: data.url, readyState: data.readyState };
    }
    default:
      throw new Error(`Unknown Vercel action: ${action}`);
  }
}

/**
 * Dispatch a tool call. Throws on error. Caller is responsible for
 * auditing the result.
 */
export async function runTool(
  toolId: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const [service, action] = toolId.split(".", 2);
  if (!service || !action) throw new Error(`Malformed tool id: ${toolId}`);
  if (service === "vercel") return runVercelTool(action, params);
  throw new Error(`Unknown cowork service: ${service}`);
}
