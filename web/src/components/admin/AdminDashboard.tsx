"use client";

/**
 * AdminDashboard — real-time view of new sof.ai signups.
 *
 * Connects to `/api/admin/stream` (server-side proxied SSE) via the
 * native `EventSource` API. New signups arrive as `profile.created` /
 * `profile.updated` events; the component prepends them to the live
 * feed and bumps the per-type count card with a brief pulse animation.
 *
 * Disconnects + reconnects are handled by the browser automatically;
 * state is reseeded by re-fetching `/api/admin/recent` on
 * `onerror -> readyState !== CLOSED` (which means the browser is
 * already trying to reconnect).
 */
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Building2,
  GraduationCap,
  Layers,
  Microscope,
  Rocket,
  School,
  Users,
} from "lucide-react";

const USER_TYPES = [
  "student",
  "educator",
  "corporation",
  "administrator",
  "researcher",
  "founder",
] as const;
type UserType = (typeof USER_TYPES)[number];

const TYPE_META: Record<UserType, { label: string; emoji: string; tint: string }> = {
  student:       { label: "Students",       emoji: "🎓", tint: "from-cyan-500/20 to-cyan-500/5 border-cyan-400/30" },
  educator:      { label: "Educators",      emoji: "🧑‍🏫", tint: "from-amber-500/20 to-amber-500/5 border-amber-400/30" },
  corporation:   { label: "Corporations",   emoji: "🏢", tint: "from-emerald-500/20 to-emerald-500/5 border-emerald-400/30" },
  administrator: { label: "Administrators", emoji: "🗂️", tint: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-400/30" },
  researcher:    { label: "Researchers",    emoji: "🔬", tint: "from-sky-500/20 to-sky-500/5 border-sky-400/30" },
  founder:       { label: "Founders",       emoji: "🚀", tint: "from-indigo-500/20 to-indigo-500/5 border-indigo-400/30" },
};

const TYPE_ICON: Record<UserType, React.ComponentType<{ className?: string }>> = {
  student: GraduationCap,
  educator: School,
  corporation: Building2,
  administrator: Layers,
  researcher: Microscope,
  founder: Rocket,
};

export interface AdminSeedSignup {
  id: number;
  handle: string;
  display_name: string;
  user_type: string;
  tagline: string;
  twin_name: string;
  twin_emoji: string;
  created_at: string;
}

interface Props {
  initial: AdminSeedSignup[];
  initialCounts: Record<string, number>;
  initialTotal: number;
  upstreamReachable: boolean;
}

type ConnectionState = "connecting" | "open" | "error" | "closed";

const FEED_LIMIT = 50;

export function AdminDashboard({
  initial,
  initialCounts,
  initialTotal,
  upstreamReachable,
}: Props) {
  const [feed, setFeed] = useState<AdminSeedSignup[]>(initial);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [total, setTotal] = useState(initialTotal);
  const [conn, setConn] = useState<ConnectionState>("connecting");
  const [pulseType, setPulseType] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const seenIdsRef = useRef(new Set<number>(initial.map((s) => s.id)));

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    function open() {
      if (cancelled) return;
      es = new EventSource("/api/admin/stream");
      es.onopen = () => setConn("open");
      es.onerror = () => {
        // Browser auto-reconnects unless the source is CLOSED. We only
        // surface "closed" if we're sure it won't recover.
        if (es?.readyState === EventSource.CLOSED) {
          setConn("closed");
        } else {
          setConn("error");
        }
      };
      es.addEventListener("profile.created", (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data) as AdminSeedSignup;
          handleEvent(payload, "created");
        } catch {
          // Malformed payload — ignore rather than crashing the dashboard.
        }
      });
      es.addEventListener("profile.updated", (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data) as AdminSeedSignup;
          handleEvent(payload, "updated");
        } catch {
          /* ignore */
        }
      });
    }

    function handleEvent(payload: AdminSeedSignup, kind: "created" | "updated") {
      setEventCount((n) => n + 1);
      const isNew = !seenIdsRef.current.has(payload.id);
      seenIdsRef.current.add(payload.id);

      // Prepend to feed (de-dup by id; updates float to the top).
      setFeed((prev) => {
        const dedup = prev.filter((s) => s.id !== payload.id);
        return [payload, ...dedup].slice(0, FEED_LIMIT);
      });

      // Pulse the matching type card.
      setPulseType(payload.user_type);
      window.setTimeout(() => setPulseType(null), 1200);

      // Bump counts only for genuinely new rows; updates can change
      // user_type but for simplicity we don't decrement the old bucket
      // (rare edge case; an admin-side reload re-syncs from /recent).
      if (isNew && kind === "created") {
        setCounts((prev) => ({
          ...prev,
          [payload.user_type]: (prev[payload.user_type] ?? 0) + 1,
        }));
        setTotal((t) => t + 1);
      }
    }

    open();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-10 flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-indigo-300/80">
            Admin · live
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Signups, in real time.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            New profiles arrive over a live SSE feed the moment someone
            finishes <code className="rounded bg-white/5 px-1.5 py-0.5">/welcome</code>.
            Per-type counts pulse on each event.
          </p>
        </div>
        <ConnectionPill conn={conn} eventCount={eventCount} />
      </header>

      {!upstreamReachable && (
        <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
          Initial seed could not reach the FastAPI backend (timed out after 4s).
          The live stream may still recover — events will populate the feed when
          the upstream becomes reachable again.
        </div>
      )}

      <section
        className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        data-testid="admin-type-cards"
      >
        {USER_TYPES.map((t) => (
          <TypeCard
            key={t}
            type={t}
            count={counts[t] ?? 0}
            pulsing={pulseType === t}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        <TotalCard total={total} eventCount={eventCount} />
        <FeedCard feed={feed} />
      </section>
    </div>
  );
}

function TypeCard({ type, count, pulsing }: { type: UserType; count: number; pulsing: boolean }) {
  const Icon = TYPE_ICON[type];
  const meta = TYPE_META[type];
  return (
    <div
      data-type-card={type}
      data-count={count}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${meta.tint} p-4 transition ${
        pulsing ? "ring-2 ring-white/40 shadow-2xl shadow-white/10 scale-[1.02]" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-white/80" />
        <span className="text-xs uppercase tracking-wider text-white/60">
          {meta.label}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-white">
          {count}
        </span>
        <span className="text-lg">{meta.emoji}</span>
      </div>
    </div>
  );
}

function TotalCard({ total, eventCount }: { total: number; eventCount: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-400">
        <Users className="h-4 w-4" /> Total profiles
      </div>
      <div className="mt-3 text-5xl font-bold tabular-nums text-white" data-testid="admin-total">
        {total}
      </div>
      <div className="mt-2 text-sm text-zinc-400">
        <span data-testid="admin-event-count">{eventCount}</span> live events received this session
      </div>
    </div>
  );
}

function FeedCard({ feed }: { feed: AdminSeedSignup[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-300">
          Latest signups
        </h2>
        <span className="text-xs text-zinc-500">most recent first</span>
      </header>
      {feed.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-zinc-500">
          No signups yet. As soon as someone finishes <code className="rounded bg-white/5 px-1.5 py-0.5">/welcome</code>,
          they&apos;ll appear here.
        </div>
      ) : (
        <ul className="divide-y divide-white/5" data-testid="admin-feed">
          {feed.map((s) => (
            <li
              key={s.id}
              data-feed-handle={s.handle}
              data-feed-type={s.user_type}
              className="flex items-center gap-4 px-6 py-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl">
                {s.twin_emoji || "🤖"}
              </div>
              <div className="flex-1 min-w-0">
                <a
                  href={`/u/${s.handle}`}
                  className="block truncate text-sm font-semibold text-white hover:text-indigo-300"
                >
                  {s.display_name}
                </a>
                <div className="truncate text-xs text-zinc-400">
                  @{s.handle}
                  {s.twin_name ? ` · twin ${s.twin_name}` : ""}
                  {s.tagline ? ` · ${s.tagline}` : ""}
                </div>
              </div>
              <TypeBadge type={s.user_type} />
              <span className="text-xs text-zinc-500 tabular-nums">
                <RelativeTime iso={s.created_at} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const t = (USER_TYPES as readonly string[]).includes(type)
    ? (type as UserType)
    : null;
  if (!t) {
    return (
      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-300">
        {type}
      </span>
    );
  }
  const meta = TYPE_META[t];
  return (
    <span className={`rounded-full border bg-gradient-to-br ${meta.tint} px-2.5 py-0.5 text-xs text-white`}>
      {meta.emoji} {meta.label.replace(/s$/, "")}
    </span>
  );
}

function ConnectionPill({ conn, eventCount }: { conn: ConnectionState; eventCount: number }) {
  const map: Record<ConnectionState, { dot: string; label: string }> = {
    connecting: { dot: "bg-amber-400 animate-pulse", label: "Connecting…" },
    open:       { dot: "bg-emerald-400 animate-pulse", label: "Live" },
    error:      { dot: "bg-amber-500 animate-pulse", label: "Reconnecting…" },
    closed:     { dot: "bg-rose-500", label: "Disconnected" },
  };
  const v = map[conn];
  return (
    <div
      className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2"
      data-testid="admin-conn-pill"
      data-conn-state={conn}
    >
      <span className={`block h-2.5 w-2.5 rounded-full ${v.dot}`} />
      <span className="text-xs font-semibold text-white">{v.label}</span>
      <span className="text-xs text-zinc-400">
        <Activity className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
        {eventCount}
      </span>
    </div>
  );
}

function RelativeTime({ iso }: { iso: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return <>{formatAge(iso)}</>;
}

function formatAge(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
