/**
 * /welcome — the first-run onboarding wizard.
 *
 * Server component:
 *   - Requires a NextAuth session; redirects unauth'd visitors to /signin
 *     with `?callbackUrl=/welcome` so they land back here after auth.
 *   - Looks up an existing UserProfile by session email. If one exists,
 *     the wizard hydrates with the saved answers (so re-visiting /welcome
 *     becomes "edit your profile + twin"). If not, it starts a fresh run.
 *
 * The actual 6-question UI is in <OnboardingWizard /> (client component)
 * so we can use multi-step state + transitions without bouncing back to
 * the server between every keystroke.
 */
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { displayNameFromEmail, handleFromEmail } from "@/lib/personaGen";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Welcome to sof.ai — spawn your AI twin",
  description:
    "Six questions, then your personal AI twin is live on your sof.ai profile. Train it through Devin over time.",
};

interface ExistingProfile {
  email: string;
  handle: string;
  display_name: string;
  user_type: string;
  tagline: string;
  location: string;
  goals: string[];
  strengths: string[];
  first_project: string;
  twin_name: string;
  twin_emoji: string;
  twin_persona_seed: string;
  devin_session_url: string;
}

async function fetchExisting(email: string): Promise<ExistingProfile | null> {
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/users/${encodeURIComponent(email)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as ExistingProfile;
  } catch {
    return null;
  }
}

export default async function WelcomePage() {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!email) {
    redirect("/signin?callbackUrl=/welcome");
  }

  const existing = await fetchExisting(email);
  const sessionName = (session?.user?.name ?? "").trim();

  // Seed defaults — used only if there's no existing profile yet.
  const defaultDisplayName = sessionName || displayNameFromEmail(email);
  const defaultHandle = handleFromEmail(email);

  const initial = {
    email,
    handle: existing?.handle ?? defaultHandle,
    display_name: existing?.display_name ?? defaultDisplayName,
    user_type: existing?.user_type ?? "",
    tagline: existing?.tagline ?? "",
    location: existing?.location ?? "",
    goals: existing?.goals ?? [],
    strengths: existing?.strengths ?? [],
    first_project: existing?.first_project ?? "",
    twin_name: existing?.twin_name ?? "",
    twin_emoji: existing?.twin_emoji ?? "🤖",
    twin_persona_seed: existing?.twin_persona_seed ?? "",
    devin_session_url: existing?.devin_session_url ?? "",
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 12%, rgba(129,140,248,0.18), transparent 55%), radial-gradient(circle at 82% 78%, rgba(232,121,249,0.16), transparent 60%), radial-gradient(circle at 50% 110%, rgba(34,211,238,0.14), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300/80">
            Welcome to sof.ai
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {existing ? "Update your profile + twin" : "Spawn your AI twin in under five minutes."}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400">
            Six quick questions. Your answers seed a personal AI twin that lives
            on your profile and learns alongside you. You&apos;ll keep training
            it over time through Devin co-work — no redeploys, just live
            updates.
          </p>
        </header>

        <OnboardingWizard initial={initial} hasExisting={Boolean(existing)} />
      </div>
    </main>
  );
}
