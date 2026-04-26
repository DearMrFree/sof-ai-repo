/**
 * /embed/{slug}/conversations/{id} — full transcript drill-down.
 *
 * Same gating as the list page. Renders the visitor↔agent conversation
 * line-by-line plus surface metadata (turn count, lead status, error
 * detail when present). PR #31 will add the insight panel beside this.
 */
import { Fragment } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { ArrowLeft, CheckCircle2, AlertTriangle, Bot, User } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { canViewAgent } from "@/lib/embed/conversations";
import { getApiBaseUrl } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

interface ConversationDetail {
  id: number;
  agent_slug: string;
  client_thread_id: string;
  owner_email: string;
  started_at: string;
  last_turn_at: string;
  turn_count: number;
  lead_submitted: boolean;
  lead_resend_message_id: string | null;
  lead_error: string | null;
  customer_meta: Record<string, string>;
  transcript: { role: "user" | "assistant"; content: string }[];
  status: string;
}

async function loadConversation(
  slug: string,
  id: number,
): Promise<ConversationDetail | null> {
  const url = `${getApiBaseUrl()}/embed/conversations/${id}`;
  const headersInit: Record<string, string> = {};
  if (process.env.INTERNAL_API_KEY) {
    headersInit["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  const res = await fetch(url, { headers: headersInit, cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as ConversationDetail;
  if (data.agent_slug !== slug) return null;
  return data;
}

function fmt(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default async function ConversationDetailPage(props: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await props.params;
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!canViewAgent(slug, email)) {
    if (!email) {
      const h = await headers();
      const host = h.get("host") ?? "sof.ai";
      const proto = h.get("x-forwarded-proto") ?? "https";
      const callback = encodeURIComponent(
        `${proto}://${host}/embed/${slug}/conversations/${id}`,
      );
      redirect(`/api/auth/signin?callbackUrl=${callback}`);
    }
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Not authorized to view this conversation.
        </div>
      </div>
    );
  }

  const numeric = Number.parseInt(id, 10);
  if (!Number.isInteger(numeric) || numeric <= 0) notFound();
  const c = await loadConversation(slug, numeric);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/embed/${slug}/conversations`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" /> All conversations
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Conversation #{c.id}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
          <span>{c.turn_count} turns</span>
          <span aria-hidden>·</span>
          <span>started {fmt(c.started_at)}</span>
          <span aria-hidden>·</span>
          <span>last activity {fmt(c.last_turn_at)}</span>
          {c.lead_submitted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Lead delivered
              {c.lead_resend_message_id && (
                <code className="ml-1 text-[10px] opacity-70">
                  {c.lead_resend_message_id}
                </code>
              )}
            </span>
          )}
        </div>
      </div>

      {c.lead_error && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">Lead delivery error</div>
            <div className="mt-0.5 text-xs font-mono break-words">
              {c.lead_error}
            </div>
          </div>
        </div>
      )}

      <ol className="space-y-3">
        {c.transcript.map((m, i) => (
          <li
            key={i}
            className={`rounded-lg border p-3 ${
              m.role === "user"
                ? "bg-white border-zinc-200"
                : "bg-zinc-50 border-zinc-200"
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-1.5">
              {m.role === "user" ? (
                <>
                  <User className="h-3.5 w-3.5" /> Visitor
                </>
              ) : (
                <>
                  <Bot className="h-3.5 w-3.5" /> {slug}
                </>
              )}
            </div>
            <div className="whitespace-pre-wrap text-sm text-zinc-900">
              {m.content}
            </div>
          </li>
        ))}
      </ol>

      <details className="mt-8 rounded-lg border border-zinc-200 bg-white p-3 text-sm">
        <summary className="cursor-pointer text-zinc-700 font-medium">
          Visitor metadata
        </summary>
        <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-1.5 text-xs text-zinc-700">
          <dt className="text-zinc-500">Thread id</dt>
          <dd className="font-mono break-all">{c.client_thread_id}</dd>
          <dt className="text-zinc-500">Status</dt>
          <dd>{c.status}</dd>
          {Object.entries(c.customer_meta || {}).map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-zinc-500">{k}</dt>
              <dd className="break-all">{String(v)}</dd>
            </Fragment>
          ))}
        </dl>
      </details>
    </div>
  );
}
