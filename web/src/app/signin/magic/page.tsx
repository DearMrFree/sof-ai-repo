"use client";

/**
 * /signin/magic?token=…&callbackUrl=…
 *
 * Landing page for the magic-link email. Auto-submits the token to the
 * NextAuth ``magic-link`` CredentialsProvider on mount. On success the
 * user lands on the requested callbackUrl (defaulting to /welcome). On
 * failure the page renders a friendly error explaining whether the link
 * has expired, has already been used, or was malformed — so nobody is
 * left on a "Loading…" spinner.
 *
 * Renders inside the existing dark theme + VRSchoolStrip; no separate
 * layout. Mirrors the visual language of /signin so the user sees a
 * consistent flow from inbox click → signed-in.
 */

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { CheckCircle2, XCircle } from "lucide-react";

type Phase = "verifying" | "success" | "error";

function MagicLandingInner() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get("token") || "";
  const callbackUrl = search.get("callbackUrl") || "/welcome";
  const [phase, setPhase] = useState<Phase>("verifying");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function go(): Promise<void> {
      if (!token) {
        if (!cancelled) {
          setPhase("error");
          setError("This link is missing a token. Try signing in again.");
        }
        return;
      }
      const res = await signIn("magic-link", {
        token,
        redirect: false,
        callbackUrl,
      });
      if (cancelled) return;
      if (res?.ok && !res.error) {
        setPhase("success");
        // Defer a tick so the success state can paint before the route
        // change yanks the page out from under the user.
        setTimeout(() => router.push(callbackUrl), 700);
        return;
      }
      setPhase("error");
      // NextAuth surfaces ``CredentialsSignin`` for any authorize()
      // failure. Our provider returns null on FastAPI 404/409/410 so
      // we can't tell them apart from the client. The friendliest
      // generic message covers all three cases.
      setError(
        "This sign-in link is invalid or has expired. Magic links work once and last 15 minutes — request a new one to continue.",
      );
    }
    void go();
    return () => {
      cancelled = true;
    };
  }, [token, callbackUrl, router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16">
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/60 p-8 shadow-2xl shadow-emerald-900/10 backdrop-blur-md">
          {phase === "verifying" && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-300/60 border-t-transparent" />
              </div>
              <h1 className="text-xl font-semibold text-white">Signing you in…</h1>
              <p className="text-center text-sm text-zinc-400">
                Verifying your magic link with School of AI.
              </p>
            </div>
          )}
          {phase === "success" && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <h1 className="text-xl font-semibold text-white">You&apos;re in.</h1>
              <p className="text-center text-sm text-zinc-400">
                Redirecting to your dashboard…
              </p>
            </div>
          )}
          {phase === "error" && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/40 bg-rose-500/10">
                <XCircle className="h-7 w-7 text-rose-300" />
              </div>
              <h1 className="text-xl font-semibold text-white">
                Magic link didn&apos;t work
              </h1>
              <p className="text-center text-sm text-zinc-400">{error}</p>
              <Link
                href="/signin"
                className="mt-2 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow hover:opacity-95"
              >
                Request a new link
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MagicLandingPage() {
  return (
    <Suspense fallback={null}>
      <MagicLandingInner />
    </Suspense>
  );
}
