"use client";

import { Suspense, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Dices,
  Mail,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";

import {
  displayNameFromEmail,
  generatePersona,
  handleFromEmail,
  type GeneratedPersona,
} from "@/lib/personaGen";

// Light-weight agent metadata for the "already inside" presence strip.
// Duplicated from @/lib/agents to keep this a pure client component and avoid
// pulling server-only deps into the sign-in bundle.
const AGENTS_INSIDE: { id: string; name: string; emoji: string; color: string }[] = [
  { id: "devin", name: "Devin", emoji: "🛠️", color: "#8b5cf6" },
  { id: "claude", name: "Claude", emoji: "🧠", color: "#f97316" },
  { id: "gemini", name: "Gemini", emoji: "💎", color: "#0ea5e9" },
  { id: "chatgpt", name: "ChatGPT", emoji: "💬", color: "#10b981" },
  { id: "mistral", name: "Mistral", emoji: "🌀", color: "#6366f1" },
  { id: "llama", name: "Llama", emoji: "🦙", color: "#ec4899" },
  { id: "grok", name: "Grok", emoji: "⚡", color: "#facc15" },
];

function SignInInner() {
  const search = useSearchParams();
  const router = useRouter();
  // After auth, send first-time visitors to /welcome so they can spawn
  // their AI twin + populate user_type. /welcome itself redirects to the
  // user's profile if they've already completed onboarding, so this is
  // safe for repeat sign-ins too.
  const callbackUrl = search.get("callbackUrl") || "/welcome";
  const isSofAiBridge = useMemo(
    () => isSofAiBridgeCallback(callbackUrl),
    [callbackUrl],
  );

  // --- State for the email fallback path.
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    friendlyError(search.get("error")),
  );

  // --- Live persona preview. Keyed by `seed` so the user can "reroll".
  const [seed, setSeed] = useState<string>(() => cryptoSeed());
  const emailSeed = email.trim().toLowerCase();
  const persona: GeneratedPersona = useMemo(() => {
    // While the user is typing an email, preview the persona *their email*
    // would produce. Otherwise use the reroll seed.
    if (emailSeed && emailSeed.includes("@")) {
      const handle = handleFromEmail(emailSeed);
      const displayName = displayNameFromEmail(emailSeed);
      // Still let the visuals come from a seeded generator on the email,
      // but force the text identity to match.
      const visual = generatePersona(emailSeed);
      return { ...visual, handle, displayName };
    }
    return generatePersona(seed);
  }, [seed, emailSeed]);

  async function handleGuest() {
    setGuestLoading(true);
    setError(null);
    const res = await signIn("guest", {
      handle: persona.handle,
      displayName: persona.displayName,
      redirect: false,
      callbackUrl,
    });
    setGuestLoading(false);
    if (res?.error) {
      setError("Couldn't start a guest session. Please try again.");
      return;
    }
    router.push(callbackUrl);
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, callbackUrl }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        error?: string;
        delivered?: boolean;
        previewLink?: string;
      };
      if (!resp.ok) {
        setError(
          data.error ||
            "We couldn't send a sign-in link right now. Please try again.",
        );
        return;
      }
      // Dev/preview without RESEND_API_KEY: auto-follow the preview link
      // so the developer flow stays one-click. In production this branch
      // is impossible because the API never returns previewLink.
      if (data.previewLink && process.env.NODE_ENV !== "production") {
        window.location.href = data.previewLink;
        return;
      }
      setMagicSent(true);
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Ambient mesh — synced with the live persona gradient so the whole
          page "dresses up" in the colors of the identity being previewed. */}
      <AmbientMesh persona={persona} />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-10 pt-6 lg:pt-10">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-white">
            sof<span className="text-indigo-400">.ai</span>
          </span>
        </Link>

        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          {/* LEFT: seamless entry card */}
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Walk into the
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
                classroom of the future.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-sm text-zinc-400 sm:text-base">
              {isSofAiBridge
                ? "Use Google or email once to connect your sof.ai profile with School of AI. Guest sessions stay local to one site."
                : "Zero forms. Zero passwords. Your identity, profile, and first study room are one click away — agents are already inside."}
            </p>

            {/* Agents presence strip */}
            <AgentsInside />

            <div className="mt-8 max-w-md space-y-3">
              {isSofAiBridge ? (
                <div className="rounded-2xl border border-indigo-400/25 bg-indigo-400/10 px-4 py-3 text-sm text-indigo-100">
                  Guest mode is great for a quick look around, but sof.ai
                  profiles need a real email so your portfolio, settings, and
                  school progress stay connected.
                </div>
              ) : (
                <>
                  {/* PRIMARY — one click guest entry */}
                  <button
                    onClick={handleGuest}
                    disabled={guestLoading || emailLoading}
                    className="group relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-4 text-left text-white shadow-[0_20px_60px_-20px] shadow-fuchsia-500/50 transition hover:brightness-110 disabled:opacity-60"
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl ring-2 ring-white/30"
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${persona.avatarGradient[0]}, ${persona.avatarGradient[1]})`,
                        }}
                        aria-hidden="true"
                      >
                        {persona.emoji}
                      </span>
                      <span className="flex flex-col">
                        <span className="text-base font-semibold">
                          {guestLoading ? "Entering the classroom…" : "Jump in"}
                        </span>
                        <span className="text-xs text-white/80">
                          You&apos;ll be{" "}
                          <span className="font-medium">@{persona.handle}</span> ·
                          one click, no form
                        </span>
                      </span>
                    </span>
                    <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSeed(cryptoSeed())}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-white"
                  >
                    <Dices className="h-3.5 w-3.5" />
                    Re-roll persona
                  </button>

                  <div className="relative py-3 text-center">
                    <span className="relative z-10 bg-zinc-950 px-3 text-[11px] uppercase tracking-wider text-zinc-500">
                      Or keep your identity
                    </span>
                    <div className="absolute left-0 top-1/2 -z-0 h-px w-full bg-zinc-800" />
                  </div>
                </>
              )}

              {/* Google */}
              <button
                onClick={() => signIn("google", { callbackUrl })}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              {/* Email magic-link — collapsed by default, one field when expanded */}
              {!emailOpen ? (
                <button
                  type="button"
                  onClick={() => setEmailOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
                >
                  <Mail className="h-4 w-4" />
                  Email me a sign-in link
                </button>
              ) : magicSent ? (
                <div
                  className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100"
                  data-testid="magic-link-sent"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <Mail className="h-4 w-4 text-emerald-300" />
                    Check your inbox
                  </div>
                  <p className="text-[12px] leading-relaxed text-emerald-200/90">
                    We sent a sign-in link to{" "}
                    <span className="font-medium text-white">{email}</span>. The
                    link expires in 15 minutes and can only be used once.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMagicSent(false);
                      setEmail("");
                    }}
                    className="text-[11px] text-emerald-300 underline-offset-4 hover:underline"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEmail} className="space-y-2">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@anywhere.com"
                      required
                      autoFocus
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-9 py-3 text-sm text-white outline-none transition focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={emailLoading || email.trim().length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:brightness-110 disabled:opacity-50"
                  >
                    {emailLoading ? "Sending…" : "Send me a magic link"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    We&apos;ll email you a one-time link. It expires in 15
                    minutes and can only be used once. No password to remember.
                  </p>
                </form>
              )}

              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {error}
                </div>
              )}
            </div>

            <p className="mt-8 max-w-md text-[11px] leading-relaxed text-zinc-500">
              By continuing, you agree to be kind in study rooms, review before
              you ship, and pair with agents at your own pace. Guest sessions
              are scoped to this browser; upgrade to email or Google anytime to
              keep your portfolio.
            </p>
          </div>

          {/* RIGHT: live profile preview */}
          <div className="relative hidden lg:block">
            <LiveProfilePreview persona={persona} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInInner />
    </Suspense>
  );
}

// --- Presence strip: shows agents "already inside" with pulsing dots.
function AgentsInside() {
  return (
    <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300 shadow-inner shadow-black/20">
      <Users className="h-3.5 w-3.5 text-emerald-400" />
      <span className="text-zinc-400">Already inside:</span>
      <span className="flex -space-x-1.5">
        {AGENTS_INSIDE.slice(0, 6).map((a) => (
          <span
            key={a.id}
            title={a.name}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] ring-2 ring-zinc-950"
            style={{ backgroundColor: `${a.color}33`, color: "white" }}
          >
            {a.emoji}
          </span>
        ))}
      </span>
      <span className="ml-1 flex items-center gap-1.5 text-emerald-300">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        live
      </span>
    </div>
  );
}

// --- Live profile preview card. Mirrors /u/[handle] at small scale so the
// user sees exactly what their profile will look like before they sign in.
function LiveProfilePreview({ persona }: { persona: GeneratedPersona }) {
  const [g1, g2] = persona.avatarGradient;
  return (
    <div className="sticky top-12">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1 text-[11px] uppercase tracking-wider text-zinc-400">
        <Wand2 className="h-3 w-3" />
        Your profile · live preview
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40">
        {/* Cover mesh that matches the on-page /u/[handle] cover exactly. */}
        <div
          className="relative h-28"
          aria-hidden="true"
          style={{
            backgroundImage: `
              radial-gradient(circle at 15% 20%, ${g1}cc, transparent 45%),
              radial-gradient(circle at 85% 30%, ${g2}cc, transparent 55%),
              radial-gradient(circle at 60% 80%, ${persona.accentThird}b3, transparent 55%),
              linear-gradient(135deg, #0f0f14, #18181b)
            `,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "3px 3px",
            }}
          />
        </div>

        <div className="relative px-5 pb-5">
          <div
            className="mt-[-2rem] flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ring-4 ring-zinc-950"
            style={{
              backgroundImage: `linear-gradient(135deg, ${g1}, ${g2})`,
              boxShadow: `0 20px 60px -20px ${g1}`,
            }}
          >
            {persona.emoji}
          </div>
          <div className="mt-3">
            <h2 className="text-lg font-bold tracking-tight text-white">
              {persona.displayName}
            </h2>
            <p className="text-sm text-zinc-400">@{persona.handle}</p>
            <p className="mt-2 text-xs text-zinc-500">
              Just joined. Here to learn, train, build.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Shipped", value: "0" },
              { label: "XP", value: "0" },
              { label: "Streak", value: "1d" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-2 py-2"
              >
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {s.label}
                </div>
                <div className="text-sm font-semibold text-white">
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 px-3 py-3 text-[11px] leading-relaxed text-zinc-500">
            Your first build ships here. Shipped, in-progress, and draft work
            — an App Store of you. Your profile page is{" "}
            <span className="font-medium text-zinc-300">/u/{persona.handle}</span>.
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Page-level ambient mesh that recolors with the persona preview.
function AmbientMesh({ persona }: { persona: GeneratedPersona }) {
  const [g1, g2] = persona.avatarGradient;
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 transition-[background-image] duration-700"
      aria-hidden="true"
      style={{
        backgroundImage: `
          radial-gradient(circle at 10% 0%, ${g1}33, transparent 40%),
          radial-gradient(circle at 90% 20%, ${g2}33, transparent 45%),
          radial-gradient(circle at 50% 90%, ${persona.accentThird}22, transparent 60%)
        `,
      }}
    />
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.6 14.6 2.6 12 2.6 6.7 2.6 2.4 6.9 2.4 12.1c0 5.2 4.3 9.5 9.6 9.5 5.5 0 9.2-3.9 9.2-9.3 0-.6-.1-1.1-.2-1.7H12z"
      />
    </svg>
  );
}

// --- Utilities.
function cryptoSeed(): string {
  if (typeof window !== "undefined" && "crypto" in window) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

function isSofAiBridgeCallback(callbackUrl: string): boolean {
  try {
    const url = new URL(callbackUrl, "https://ai.thevrschool.org");
    const domain = (url.searchParams.get("domain") ?? "").toLowerCase();
    return (
      url.pathname === "/api/auth/sso/handoff" &&
      (domain === "sof.ai" || domain === "www.sof.ai")
    );
  } catch {
    return false;
  }
}

function friendlyError(code: string | null): string | null {
  if (code === "GuestBridgeRequiresEmail") {
    return "Guest sessions stay local. Use Google or an email link once to connect sof.ai with your School of AI profile.";
  }
  return null;
}
