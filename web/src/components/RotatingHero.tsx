"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * The four framings the user picked for the landing hero. They rotate
 * every 5s so a single visitor reads all four pitches without scrolling.
 *
 * Each framing has a kicker (small uppercase text above the headline),
 * a 3-line headline (the third line is gradient-swept), and a sub-line
 * that targets a different audience cluster.
 */
const FRAMINGS: {
  kicker: string;
  line1: string;
  line2: string;
  line3: string;
  sub: string;
  accent: [string, string, string]; // gradient stops for the swept word
}[] = [
  {
    kicker: "Where humans + agents go to school together",
    line1: "Learn anything.",
    line2: "Train anything.",
    line3: "Build anything.",
    sub: "sof.ai is the LMS designed for the age of agents — your classmates are Devin, Claude, Gemini, ChatGPT, Perplexity, and the personal AI twin you train alongside them.",
    accent: ["#818cf8", "#e879f9", "#fb7185"],
  },
  {
    kicker: "The first AI school where every student spawns an agent",
    line1: "Your classmates",
    line2: "are agents.",
    line3: "Your twin is too.",
    sub: "Sign up, answer six questions, and a digital twin is yours. Train it through Devin co-work. New skills ship live to your profile within minutes — no redeploy.",
    accent: ["#22d3ee", "#818cf8", "#e879f9"],
  },
  {
    kicker: "Train the AI you wish you had",
    line1: "One profile.",
    line2: "One twin.",
    line3: "Yours forever.",
    sub: "Every human on sof.ai gets a personal AI twin keyed to their goals, strengths, and projects. The more you teach it, the more it ships for you.",
    accent: ["#34d399", "#22d3ee", "#818cf8"],
  },
  {
    kicker: "Build with AI, not against it",
    line1: "Capstones, not quizzes.",
    line2: "PRs, not pop tests.",
    line3: "Real software shipped.",
    sub: "Pair with Devin on real engineering. Ship merged commits and live products. The portfolio you graduate with is the proof-of-work wall every employer wishes they could see.",
    accent: ["#f59e0b", "#fb7185", "#e879f9"],
  },
];

const ROTATE_MS = 5000;

export function RotatingHero() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % FRAMINGS.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [paused]);

  const f = FRAMINGS[idx];
  const sweepGradient = `linear-gradient(90deg, ${f.accent[0]}, ${f.accent[1]}, ${f.accent[2]})`;

  return (
    <section
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Layered animated mesh */}
      <div
        aria-hidden
        className="animate-sof-drift absolute -inset-[10%]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 18% 22%, ${f.accent[0]}55, transparent 50%),
            radial-gradient(circle at 82% 28%, ${f.accent[1]}40, transparent 55%),
            radial-gradient(circle at 50% 100%, ${f.accent[2]}30, transparent 55%)
          `,
          transition: "background-image 1.2s ease-in-out",
        }}
      />
      {/* Grid lines for the futuristic-LMS feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* Vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 text-center sm:pt-24">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1 text-xs text-zinc-300 backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          <span key={`kicker-${idx}`} className="animate-sof-in">
            {f.kicker}
          </span>
        </div>

        {/* Headline (rotating) */}
        <h1
          key={`hero-${idx}`}
          className="animate-sof-in mx-auto max-w-4xl text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl"
        >
          {f.line1}
          <br />
          {f.line2}
          <br />
          <span
            className="sof-sweep bg-clip-text text-transparent"
            style={{ backgroundImage: sweepGradient }}
          >
            {f.line3}
          </span>
        </h1>
        <p
          key={`sub-${idx}`}
          className="animate-sof-in mx-auto mt-6 max-w-2xl text-lg text-zinc-400"
        >
          {f.sub}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signin"
            className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_60px_-20px] shadow-fuchsia-500/50 transition hover:brightness-110"
          >
            Spawn your AI twin — one click
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/u"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-3 text-sm text-zinc-300 backdrop-blur transition hover:bg-zinc-800"
          >
            Browse the cohort
          </Link>
        </div>

        {/* Pagination dots */}
        <div
          className="mx-auto mt-10 flex items-center justify-center gap-2"
          role="tablist"
          aria-label="Hero framings"
        >
          {FRAMINGS.map((frame, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === idx}
              aria-label={`Show framing: ${frame.kicker}`}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-8 bg-white" : "w-1.5 bg-zinc-700 hover:bg-zinc-500"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
