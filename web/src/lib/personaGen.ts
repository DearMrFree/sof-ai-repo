/**
 * Pure client- and server-safe helpers for generating a "first look" persona
 * for a new sof.ai learner. Used by the seamless sign-up flow and live
 * profile preview on /signin so onboarding feels generative, not form-filling.
 */

const ADJECTIVES = [
  "curious",
  "brave",
  "quiet",
  "lucid",
  "kind",
  "sharp",
  "steady",
  "fresh",
  "bright",
  "open",
  "patient",
  "nimble",
  "candid",
  "eager",
  "rigorous",
  "playful",
  "stubborn",
  "honest",
];

const ANIMALS = [
  "fox",
  "owl",
  "heron",
  "otter",
  "lynx",
  "bear",
  "crane",
  "panda",
  "falcon",
  "lemur",
  "wolf",
  "beluga",
  "orca",
  "wren",
  "tiger",
  "ibis",
  "badger",
  "raven",
];

const EMOJIS = [
  "🦊",
  "🦉",
  "🦦",
  "🐻",
  "🐼",
  "🦁",
  "🐯",
  "🐺",
  "🦅",
  "🧑‍🚀",
  "🧑‍🎓",
  "🧑‍💻",
  "👩‍💻",
  "👨‍💻",
  "🧑‍🔬",
];

/**
 * Gradient pairs tuned to look great on dark mode. Each one is a [start, end]
 * pair + a third accent color for the ambient cover mesh on the profile page.
 */
const PALETTES: Array<[string, string, string]> = [
  ["#8b5cf6", "#ec4899", "#22d3ee"],
  ["#f97316", "#ef4444", "#f59e0b"],
  ["#0ea5e9", "#22d3ee", "#6366f1"],
  ["#10b981", "#14b8a6", "#22d3ee"],
  ["#6366f1", "#8b5cf6", "#ec4899"],
  ["#ec4899", "#f43f5e", "#fb923c"],
  ["#06b6d4", "#3b82f6", "#8b5cf6"],
  ["#84cc16", "#22c55e", "#14b8a6"],
  ["#facc15", "#f97316", "#ef4444"],
];

export interface GeneratedPersona {
  handle: string;
  displayName: string;
  emoji: string;
  avatarGradient: [string, string];
  accentThird: string;
}

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** A deterministic seeded RNG so previews are stable across re-renders. */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    // xorshift32
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

/**
 * Generate a persona from a seed string (email, handle, anything stable).
 * If seed is empty/undefined, returns a fresh random persona.
 */
export function generatePersona(seed?: string): GeneratedPersona {
  const rnd = seed
    ? seededRandom(seed.toLowerCase())
    : () => Math.random();

  const adj = pick(ADJECTIVES, rnd);
  const animal = pick(ANIMALS, rnd);
  const emoji = pick(EMOJIS, rnd);
  const palette = pick(PALETTES, rnd);

  // Append 2 digits so handles are (mostly) unique.
  const suffix = Math.floor(rnd() * 90 + 10);
  const handle = `${adj}-${animal}-${suffix}`;
  // e.g. "Curious Fox"
  const displayName = `${cap(adj)} ${cap(animal)}`;

  return {
    handle,
    displayName,
    emoji,
    avatarGradient: [palette[0], palette[1]],
    accentThird: palette[2],
  };
}

/** Derive a handle from an email address: "ada.lovelace@x.com" → "ada-lovelace". */
export function handleFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const clean = local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "learner";
}

/** Derive a display name from an email address. "ada.lovelace" → "Ada Lovelace". */
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) return "Learner";
  return parts.map(cap).join(" ");
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
