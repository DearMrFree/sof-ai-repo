/**
 * /embed/{slug}/insights — Blajon's training-insights console.
 *
 * Closes the loop the LuxAI1 ↔ sof.ai feedback design depends on:
 * the conversations page (PR #30) shows what visitors said; this page
 * shows what those conversations MEAN — labeled by the daily Devin
 * classifier so capability gaps and missed leads stop hiding in noise.
 *
 * Gated to the agent's owner + lead professors. As LuxAI1 talks to
 * more customers, this view ranks the highest-signal training nudges
 * to the top of Blajon's backlog.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { canViewAgent, ownerEmailFor } from "@/lib/embed/conversations";
import { getApiBaseUrl } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

type InsightType =
  | "missed_lead"
  | "capability_gap"
  | "off_brand"
  | "great_save";

interface InsightOut {
  id: number;
  conversation_id: number;
  agent_slug: string;
  classified_at: string;
  classifier_model: string;
  insight_type: InsightType;
  summary: string;
  signal_score: number;
  suggested_capability: string | null;
  reasoning: string;
}

interface ConversationSummary {
  id: number;
  client_thread_id: string;
  preview: string;
  turn_count: number;
  last_turn_at: string;
  lead_submitted: boolean;
  status: string;
}

interface InsightItem {
  insight: InsightOut;
  conversation: ConversationSummary;
}

interface ListResponse {
  items: InsightItem[];
  total: number;
  by_type: Record<string, number>;
}

async function loadList(slug: string): Promise<ListResponse | null> {
  const url = `${getApiBaseUrl()}/embed/${slug}/insights?limit=200`;
  const headersInit: Record<string, string> = {};
  if (process.env.INTERNAL_API_KEY) {
    headersInit["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  const res = await fetch(url, { headers: headersInit, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as ListResponse;
}

const TYPE_META: Record<
  InsightType,
  {
    label: string;
    cls: string;
    Icon: React.ComponentType<{ className?: string }>;
    description: string;
  }
> = {
  missed_lead: {
    label: "Missed lead",
    cls: "bg-rose-50 text-rose-700 border-rose-200",
    Icon: AlertTriangle,
    description: "Visitor showed buying intent but no lead was captured.",
  },
  capability_gap: {
    label: "Capability gap",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    Icon: HelpCircle,
    description: "Agent couldn't crisply answer a real question.",
  },
  off_brand: {
    label: "Off-brand",
    cls: "bg-violet-50 text-violet-700 border-violet-200",
    Icon: ShieldAlert,
    description: "Agent reply drifted from the agent's voice or brief.",
  },
  great_save: {
    label: "Great save",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: CheckCircle2,
    description: "Agent handled a tricky thread well — keep doing this.",
  },
};

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

function scoreBadge(score: number): { label: string; cls: string } {
  if (score >= 0.85) {
    return {
      label: `${Math.round(score * 100)}% signal`,
      cls: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }
  if (score >= 0.55) {
    return {
      label: `${Math.round(score * 100)}% signal`,
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  return {
    label: `${Math.round(score * 100)}% signal`,
    cls: "bg-zinc-50 text-zinc-600 border-zinc-200",
  };
}

export default async function InsightsListPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!canViewAgent(slug, email)) {
    if (!email) {
      const h = await headers();
      const host = h.get("host") ?? "sof.ai";
      const proto = h.get("x-forwarded-proto") ?? "https";
      const callback = encodeURIComponent(
        `${proto}://${host}/embed/${slug}/insights`,
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
            This insights console is restricted to the agent&apos;s owner and
            its lead professors at sof.ai. Sign in with the correct account
            to view classified insights.
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
          <Sparkles className="h-7 w-7 text-violet-600" />
          {slug.toUpperCase()} — training insights
        </h1>
        <p className="mt-2 text-zinc-600 max-w-2xl">
          Devin classifies every closed conversation into one of four types
          and ranks the most actionable to the top. Use this view to spot
          missed leads and capability gaps as they happen — propose new
          training context in the trainer console (coming soon).
        </p>
        <div className="mt-3 text-sm">
          <Link
            href={`/embed/${slug}/conversations`}
            className="text-emerald-700 hover:text-emerald-900 underline-offset-4 hover:underline"
          >
            ← All conversations
          </Link>
        </div>
        {data && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(Object.keys(TYPE_META) as InsightType[]).map((t) => {
              const meta = TYPE_META[t];
              const count = data.by_type[t] ?? 0;
              const Icon = meta.Icon;
              return (
                <span
                  key={t}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium ${meta.cls}`}
                  title={meta.description}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}: <strong>{count}</strong>
                </span>
              );
            })}
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
          <TrendingUp className="h-8 w-8 mx-auto text-zinc-400" />
          <p className="mt-3">
            No insights yet. The daily classifier runs at 09:00 UTC and labels
            every closed conversation with no insight row.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            New conversations need ~5 minutes of quiet (or a flip to
            <code className="mx-1">converted</code> /
            <code className="ml-1">abandoned</code>) before they enter the
            queue.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.items.map((row) => {
            const { insight, conversation } = row;
            const meta = TYPE_META[insight.insight_type];
            const Icon = meta.Icon;
            const score = scoreBadge(insight.signal_score);
            return (
              <li
                key={insight.id}
                className="rounded-lg border border-zinc-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <Link
                  href={`/embed/${slug}/conversations/${conversation.id}`}
                  className="block p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium whitespace-nowrap ${meta.cls}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium whitespace-nowrap ${score.cls}`}
                      >
                        {score.label}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500 whitespace-nowrap">
                      {relTime(insight.classified_at)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-900 font-medium">
                    {insight.summary || "(no summary)"}
                  </p>
                  {insight.suggested_capability && (
                    <p className="mt-2 text-sm text-zinc-700 italic border-l-2 border-violet-200 pl-3">
                      Suggested capability: {insight.suggested_capability}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-zinc-500 truncate">
                    From visitor: “
                    {conversation.preview || "(empty conversation)"}”
                    {" · "}
                    {conversation.turn_count} turn
                    {conversation.turn_count === 1 ? "" : "s"}
                  </p>
                </Link>
                {insight.suggested_capability && (
                  <div className="px-4 pb-3 -mt-1">
                    <Link
                      href={`/embed/${slug}/trainer?from_insight=${
                        insight.id
                      }&suggested=${encodeURIComponent(
                        insight.suggested_capability,
                      )}`}
                      className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                    >
                      <Sparkles className="h-3 w-3" />
                      Propose capability →
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
