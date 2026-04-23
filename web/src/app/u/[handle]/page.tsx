import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Flame,
  Hammer,
  MapPin,
  MessageSquare,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { getPerson, listPeople } from "@/lib/people";
import { AGENTS } from "@/lib/agents";
import { buildsFor } from "@/lib/builds";
import { BuildCard } from "@/components/BuildCard";
import { BuildGrid } from "@/components/BuildGrid";
import { FollowButton } from "@/components/FollowButton";
import { ShareButton } from "@/components/ShareButton";
import { AgentAvatar } from "@/components/AgentAvatar";

export function generateStaticParams() {
  return [
    ...listPeople().map((p) => ({ handle: p.handle })),
    ...AGENTS.map((a) => ({ handle: a.id })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: { handle: string };
}) {
  const person = resolveProfile(params.handle);
  if (!person) return { title: "Profile — sof.ai" };
  return {
    title: `${person.name} — sof.ai`,
    description: person.tagline,
  };
}

interface ResolvedProfile {
  kind: "person" | "agent";
  handle: string; // without @
  name: string;
  tagline: string;
  bio: string;
  emoji: string;
  gradient: [string, string];
  accentThird: string;
  pills: string[];
  location?: string;
  pronouns?: string;
  joined?: string;
  highlightReel: string;
  followers: number;
  following: number;
  xp: number;
  streakDays: number;
  topAgents: string[];
  links?: { label: string; href: string }[];
  /** Set only when kind=agent so we can link to the chat page. */
  agentId?: string;
}

function resolveProfile(handleParam: string): ResolvedProfile | null {
  const handle = handleParam.toLowerCase().replace(/^@/, "");
  const person = getPerson(handle);
  if (person) {
    return {
      kind: "person",
      handle: person.handle,
      name: person.name,
      tagline: person.tagline,
      bio: person.bio,
      emoji: person.emoji,
      gradient: person.avatarGradient,
      accentThird: person.accentThird,
      pills: person.pills,
      location: person.location,
      pronouns: person.pronouns,
      joined: person.joined,
      highlightReel: person.highlightReel,
      followers: person.followers,
      following: person.following,
      xp: person.xp,
      streakDays: person.streakDays,
      topAgents: person.topAgents,
      links: person.links,
    };
  }
  const agent = AGENTS.find((a) => a.id === handle || a.handle === `@${handle}`);
  if (agent) {
    return {
      kind: "agent",
      handle: agent.id,
      name: agent.name,
      tagline: agent.tagline,
      bio: agent.bio,
      emoji: agent.emoji,
      gradient: agent.avatarGradient,
      accentThird: "#8b5cf6",
      pills: [agent.provider, ...agent.strengths.slice(0, 2)],
      highlightReel: `${agent.name} is a ${agent.provider} agent available in every study room on sof.ai. ${agent.tagline}`,
      followers: 4200 + Math.floor(agent.name.length * 137),
      following: 0,
      xp: 9999,
      streakDays: 365,
      topAgents: AGENTS.filter((a) => a.id !== agent.id)
        .slice(0, 3)
        .map((a) => a.id),
      agentId: agent.id,
    };
  }
  return null;
}

export default function ProfilePage({
  params,
}: {
  params: { handle: string };
}) {
  const profile = resolveProfile(params.handle);
  if (!profile) notFound();

  const builds = buildsFor(profile.handle);
  const featured = builds.find((b) => b.featured) ?? builds[0];
  const rest = builds.filter((b) => b.id !== featured?.id);
  const shippedCount = builds.filter((b) => b.status === "shipped").length;
  const inProgressCount = builds.filter((b) => b.status === "in-progress").length;

  const [c1, c2] = profile.gradient;
  const c3 = profile.accentThird;

  const topAgents = profile.topAgents
    .map((id) => AGENTS.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <main className="relative mx-auto max-w-6xl px-4 pb-16">
      {/* Cover banner */}
      <section className="relative mb-6 overflow-hidden rounded-b-3xl sm:rounded-3xl sm:mt-4">
        <div
          aria-hidden
          className="h-52 w-full md:h-64"
          style={{
            backgroundImage: `
              radial-gradient(circle at 15% 20%, ${c1}cc, transparent 45%),
              radial-gradient(circle at 85% 30%, ${c2}cc, transparent 55%),
              radial-gradient(circle at 60% 80%, ${c3}b3, transparent 55%),
              linear-gradient(135deg, #0f0f14, #18181b)
            `,
          }}
        />
        {/* noise overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        />

        {/* Avatar + primary identity */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div
              className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-2xl text-4xl ring-4 ring-zinc-950 sm:h-28 sm:w-28 sm:text-5xl"
              style={{
                backgroundImage: `linear-gradient(135deg, ${c1}, ${c2})`,
                boxShadow: `0 20px 60px -20px ${c1}`,
              }}
            >
              {profile.emoji}
            </div>
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {profile.name}
                </h1>
                {profile.kind === "agent" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-indigo-300">
                    <Sparkles className="h-3 w-3" />
                    Agent
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-300">@{profile.handle}</p>
              <p className="mt-1 max-w-xl text-sm text-zinc-400">
                {profile.tagline}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <FollowButton handle={profile.handle} />
            {profile.kind === "agent" && profile.agentId ? (
              <Link
                href={`/classroom/agents/${profile.agentId}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                <MessageSquare className="h-4 w-4" />
                Chat
              </Link>
            ) : (
              <Link
                href="/classroom/rooms/study-hall"
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                <MessageSquare className="h-4 w-4" />
                Message
              </Link>
            )}
            <ShareButton />
          </div>
        </div>
      </section>

      {/* Pills + meta */}
      <section className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
        {profile.pills.map((p) => (
          <span
            key={p}
            className="rounded-full border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 capitalize text-zinc-300"
          >
            {p}
          </span>
        ))}
        {profile.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {profile.location}
          </span>
        )}
        {profile.pronouns && <span>{profile.pronouns}</span>}
        {profile.joined && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> Joined{" "}
            {new Date(profile.joined).toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
        {profile.links?.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-300 underline-offset-2 hover:underline"
          >
            {l.label}
          </a>
        ))}
      </section>

      {/* Stats strip */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <Stat
          icon={<Hammer className="h-3.5 w-3.5" />}
          label="Shipped"
          value={shippedCount}
          accent="emerald"
        />
        <Stat
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="In progress"
          value={inProgressCount}
          accent="amber"
        />
        <Stat
          icon={<Star className="h-3.5 w-3.5" />}
          label="XP"
          value={profile.xp.toLocaleString()}
        />
        <Stat
          icon={<Flame className="h-3.5 w-3.5" />}
          label="Streak"
          value={`${profile.streakDays}d`}
          accent="orange"
        />
        <Stat
          icon={<Users className="h-3.5 w-3.5" />}
          label="Followers"
          value={profile.followers.toLocaleString()}
        />
        <Stat
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="Following"
          value={profile.following.toLocaleString()}
        />
      </section>

      {/* Two-column: main content + side rail */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        <div className="space-y-10">
          {/* Generative highlight reel */}
          <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950/40 p-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-indigo-300">
                <Sparkles className="h-3.5 w-3.5" />
                AI-composed highlight
              </div>
              <span className="text-[10px] text-zinc-500">
                regenerated from recent activity
              </span>
            </div>
            <p className="text-[15px] leading-relaxed text-zinc-100">
              {profile.highlightReel}
            </p>
            <div
              aria-hidden
              className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-40 blur-3xl"
              style={{ background: `radial-gradient(circle, ${c1}, transparent 70%)` }}
            />
            <div
              aria-hidden
              className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full opacity-30 blur-3xl"
              style={{ background: `radial-gradient(circle, ${c3}, transparent 70%)` }}
            />
          </section>

          {/* About */}
          {profile.bio && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                About
              </h2>
              <p className="text-[15px] leading-relaxed text-zinc-300">{profile.bio}</p>
            </section>
          )}

          {/* Now building — hero build */}
          {featured && (
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  {featured.status === "shipped" ? "Latest build" : "Now building"}
                </h2>
                <p className="text-[11px] text-zinc-500">
                  last updated{" "}
                  {new Date(featured.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <BuildCard build={featured} variant="hero" />
            </section>
          )}

          {/* App-Store-style build grid */}
          {rest.length > 0 ? (
            <BuildGrid builds={rest} />
          ) : builds.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 p-10 text-center">
              <p className="text-sm text-zinc-400">
                {profile.name}&apos;s wall is quiet — for now.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Builds show up here as lessons, PRs, and write-ups ship.
              </p>
            </section>
          ) : null}
        </div>

        {/* Right rail */}
        <aside className="space-y-6">
          {/* Agent collaborators */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Agent collaborators
            </h3>
            <ul className="space-y-2">
              {topAgents.map((agent) => (
                <li key={agent.id}>
                  <Link
                    href={`/u/${agent.id}`}
                    className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-zinc-900"
                  >
                    <AgentAvatar agent={agent} size="sm" showStatus />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {agent.name}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {agent.strengths[0]}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Who else to follow */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              People on sof.ai
            </h3>
            <ul className="space-y-2">
              {listPeople()
                .filter((p) => p.handle !== profile.handle && p.handle !== "you")
                .slice(0, 4)
                .map((p) => (
                  <li key={p.handle}>
                    <Link
                      href={`/u/${p.handle}`}
                      className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-zinc-900"
                    >
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm"
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${p.avatarGradient[0]}, ${p.avatarGradient[1]})`,
                        }}
                      >
                        {p.emoji}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {p.name}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500">
                          @{p.handle}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>

          {/* Tiny vibe check */}
          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
              Vibe
            </p>
            <p className="mt-1 text-sm text-zinc-200">
              {vibeLine(profile.name, shippedCount, inProgressCount)}
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: "emerald" | "amber" | "orange";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "amber"
        ? "text-amber-300"
        : accent === "orange"
          ? "text-orange-300"
          : "text-white";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${accentClass}`}>{value}</div>
    </div>
  );
}

function vibeLine(name: string, shipped: number, wip: number): string {
  if (shipped + wip === 0) {
    return `${name}'s wall is brand new. First build lands soon — stars welcome.`;
  }
  if (shipped >= 3 && wip === 0) {
    return `${name} is in ship-mode. Consistent output, zero excuses.`;
  }
  if (wip >= 2) {
    return `${name} has ${wip} live projects — this is a builder in a build loop.`;
  }
  return `${name} ships work the community actually cites. Worth following.`;
}
