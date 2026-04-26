/**
 * /embed/{slug}/conversations — Blajon's training-data console.
 *
 * Lists every conversation a visitor has had with the embedded agent
 * (LuxAI1 on https://ai1.llc). Gated to the agent's owner + lead
 * professors. As LuxAI1 talks to more customers, this view grows;
 * the insights pipeline (PR #31) will rank rows by signal so Blajon
 * can spot capability gaps quickly.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  Inbox,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { canViewAgent, ownerEmailFor } from "@/lib/embed/conversations";
import { getApiBaseUrl } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

interface ConversationSummary {
  id: number;
  agent_slug: string;
  client_thread_id: string;
  started_at: string;
  last_turn_at: string;
  turn_count: number;
  lead_submitted: boolean;
  lead_error: string | null;
  status: string;
  preview: string;
}

interface ListResponse {
  items: ConversationSummary[];
  total: number;
  converted_total: number;
}

async function loadList(slug: string): Promise<ListResponse | null> {
  const url = `${getApiBaseUrl()}/embed/${slug}/conversations?limit=200`;
  const headersInit: Record<string, string> = {};
  if (process.env.INTERNAL_API_KEY) {
    headersInit["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  const res = await fetch(url, { headers: headersInit, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as ListResponse;
}

function statusBadge(c: ConversationSummary): { label: string; cls: string } {
  if (c.lead_submitted) {
    return {
      label: "Lead delivered",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (c.lead_error) {
    return {
      label: "Lead error",
      cls: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }
  if (c.status === "abandoned") {
    return {
      label: "Abandoned",
      cls: "bg-zinc-50 text-zinc-500 border-zinc-200",
    };
  }
  return {
    label: "Active",
    cls: "bg-sky-50 text-sky-700 border-sky-200",
  };
}

function relTime(iso: string): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diffMin = Math.floor((Date.now() - ts) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function ConversationsListPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!canViewAgent(slug, email)) {
    // Anonymous → sign-in. Wrong-email signed-in → forbidden page below.
    if (!email) {
      const h = await headers();
      const host = h.get("host") ?? "sof.ai";
      const proto = h.get("x-forwarded-proto") ?? "https";
      const callback = encodeURIComponent(
        `${proto}://${host}/embed/${slug}/conversations`,
      );
      redirect(`/api/auth/signin?callbackUrl=${callback}`);
    }
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-lg font-semibold text-amber-900">
            Not authorized
          </h1>
          <p className="mt-2 text-sm text-amber-800">
            This training console is restricted to the agent&apos;s owner and
            its lead professors at sof.ai. Sign in with the correct account
            to view conversations.
          </p>
          <p className="mt-3 text-xs text-amber-700">
            Signed in as {email}. Owner email on file:{" "}
            <code>{ownerEmailFor(slug) || "(unset)"}</code>.
          </p>
        </div>
      </div>
    );
  }

  const data = await loadList(slug);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
          <Inbox className="h-7 w-7 text-emerald-600" />
          {slug.toUpperCase()} — training conversations
        </h1>
        <p className="mt-2 text-zinc-600 max-w-2xl">
          Every chat a visitor has had with{" "}
          <span className="font-medium">{slug}</span> on the embedded widget.
          As the agent trains at sof.ai, this transcript stream becomes the
          substrate for Devin&apos;s insights pipeline and your capability
          proposals.
        </p>
        {data && (
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-zinc-600">
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-zinc-500" />
              <strong className="text-zinc-900">{data.total}</strong>{" "}
              conversations
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <strong className="text-zinc-900">
                {data.converted_total}
              </strong>{" "}
              leads delivered
            </span>
            <Link
              href={`/embed/${slug}/insights`}
              className="inline-flex items-center gap-1.5 text-violet-700 hover:text-violet-900 underline-offset-4 hover:underline"
            >
              <Sparkles className="h-4 w-4" />
              View classified insights →
            </Link>
          </div>
        )}
      </div>

      {!data ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-800 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">Couldn&apos;t reach the API.</div>
            <div className="text-sm mt-1">
              Try refreshing — if this persists, the FastAPI backend may be
              temporarily down.
            </div>
          </div>
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-zinc-600">
          <MessageSquare className="h-8 w-8 mx-auto text-zinc-400" />
          <p className="mt-3">
            No conversations yet. The first visitor on{" "}
            {slug === "luxai1" ? "ai1.llc" : "the embed host"} will land here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.items.map((c) => {
            const badge = statusBadge(c);
            return (
              <li
                key={c.id}
                className="rounded-lg border border-zinc-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <Link
                  href={`/embed/${slug}/conversations/${c.id}`}
                  className="block p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-900 truncate font-medium">
                        {c.preview || "(empty conversation)"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {c.turn_count} turn{c.turn_count === 1 ? "" : "s"} ·{" "}
                        last activity {relTime(c.last_turn_at)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium whitespace-nowrap ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
