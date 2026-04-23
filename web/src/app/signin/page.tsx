"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

function SignInInner() {
  const search = useSearchParams();
  const router = useRouter();
  const callbackUrl = search.get("callbackUrl") || "/learn";

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDemo(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("demo", {
      email,
      name,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      setError("Couldn't sign in. Use a valid email.");
      return;
    }
    router.push(callbackUrl);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-white">
            sof<span className="text-indigo-400">.ai</span>
          </span>
        </Link>

        <h1 className="text-3xl font-bold tracking-tight text-white">
          Welcome to School of AI
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sign in to start learning, training, and building.
        </p>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="relative py-2 text-center">
            <span className="relative z-10 bg-zinc-950 px-3 text-xs uppercase tracking-wider text-zinc-500">
              or
            </span>
            <div className="absolute left-0 top-1/2 -z-0 h-px w-full bg-zinc-800" />
          </div>

          <form onSubmit={handleDemo} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@sof.ai"
                required
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Display name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500"
              />
            </div>
            {error && (
              <div className="rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Continue with email"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-zinc-500">
            Demo login is enabled in development — any valid email works. Configure Google OAuth for production.
          </p>
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

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
