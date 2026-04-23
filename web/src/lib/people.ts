/**
 * People registry — humans on sof.ai.
 *
 * Every person (and every agent via agents.ts) gets a profile page at
 * /u/[handle] that looks like an App Store for their builds crossed with
 * the best of LinkedIn + Insta + Facebook. Handles are case-insensitive
 * and stored without the leading '@'.
 */

export type PersonRole =
  | "principal"
  | "learner"
  | "mentor"
  | "alum"
  | "instructor";

export interface Person {
  handle: string; // "ada" (no @)
  name: string;
  tagline: string;
  bio: string;
  location?: string;
  role: PersonRole;
  /** Badge labels that sit next to the name. */
  pills: string[];
  emoji: string;
  avatarGradient: [string, string];
  /** A third color used for ambient cover mesh. */
  accentThird: string;
  /** Rendered in the "AI-composed highlight reel". */
  highlightReel: string;
  joined: string; // ISO date
  pronouns?: string;
  /** Agent ids this person collaborates with most. */
  topAgents: string[];
  followers: number;
  following: number;
  xp: number;
  streakDays: number;
  links?: { label: string; href: string }[];
}

export const PEOPLE: Person[] = [
  {
    handle: "freedom",
    name: "Dr. Freedom Cheteni",
    tagline: "Principal of sof.ai. Building the classroom of the future.",
    bio: "Founder of the School of AI. Previously ran The VR School. Obsessed with learning environments where humans and agents co-evolve — classrooms where you ship real software, not just pass quizzes.",
    location: "Everywhere / online",
    role: "principal",
    pills: ["Principal", "Founder", "Builder"],
    emoji: "🎓",
    avatarGradient: ["#8b5cf6", "#ec4899"],
    accentThird: "#22d3ee",
    highlightReel:
      "Shipping sof.ai itself this week — the classroom of the future is live. Pairing with Devin daily. Looking for the first 100 learners who want to ship real software alongside agents, not just watch videos about it.",
    joined: "2024-02-01",
    pronouns: "he/him",
    topAgents: ["devin", "claude", "gemini"],
    followers: 1284,
    following: 47,
    xp: 5280,
    streakDays: 42,
    links: [
      { label: "sof.ai", href: "https://sof.ai" },
      { label: "thevrschool.org", href: "https://thevrschool.org" },
    ],
  },
  {
    handle: "ada",
    name: "Ada L.",
    tagline: "Backend curious. Turning SQL queries into superpowers.",
    bio: "Second-year CS student. Was terrified of PRs a month ago. Today Devin and I ship one a week. On a mission to stop being the person who ‘knows the language but freezes on the repo.’",
    location: "Boston, MA",
    role: "learner",
    pills: ["Software Engineer cohort", "PR-curious", "Writes decent commit messages now"],
    emoji: "👩‍💻",
    avatarGradient: ["#f97316", "#ef4444"],
    accentThird: "#f59e0b",
    highlightReel:
      "Reviewing a Devin-authored PR this week that refactors auth into its own module. Last week I couldn't read a stack trace without panicking. This week I'm the one leaving the review comments.",
    joined: "2025-09-14",
    pronouns: "she/her",
    topAgents: ["devin", "gemini", "claude"],
    followers: 214,
    following: 58,
    xp: 1820,
    streakDays: 18,
  },
  {
    handle: "maya",
    name: "Maya R.",
    tagline: "Reading is the job. Finishes every module.",
    bio: "Bootcamp graduate who found sof.ai when she realized the best engineers she knew all read code like it was the morning paper. Completed module 2 of Software Engineer. Obsessed with notation, rubrics, and — lately — rebases.",
    location: "Lagos, NG",
    role: "learner",
    pills: ["Software Engineer cohort", "Module 2 cleared", "Top reviewer"],
    emoji: "🧑‍💻",
    avatarGradient: ["#0ea5e9", "#22d3ee"],
    accentThird: "#6366f1",
    highlightReel:
      "Just shipped reading-is-the-job notes — a distilled summary of every code review pattern from module 2. Peers are already using it. Next: dragging three friends into the classroom.",
    joined: "2025-08-02",
    pronouns: "she/her",
    topAgents: ["claude", "gemini", "devin"],
    followers: 402,
    following: 92,
    xp: 2940,
    streakDays: 29,
  },
  {
    handle: "jun",
    name: "Jun K.",
    tagline: "Front-end to full-stack via Devin-assisted refactors.",
    bio: "React dev for five years, finally breaking into the backend. Prefers pairing with Devin on refactors and with Grok on arguments about whether `useReducer` is worth it. Spoiler: sometimes.",
    location: "Seoul, KR",
    role: "learner",
    pills: ["Software Engineer cohort", "Refactor enjoyer", "Ex-solo dev"],
    emoji: "👨‍🎓",
    avatarGradient: ["#10b981", "#14b8a6"],
    accentThird: "#22d3ee",
    highlightReel:
      "In progress: a Devin-authored refactor of a 7k-line component tree into hooks. Reading the diff now. It feels like when the calculator arrived in math class — uncomfortable, then obvious.",
    joined: "2025-10-01",
    pronouns: "he/him",
    topAgents: ["devin", "grok", "claude"],
    followers: 186,
    following: 41,
    xp: 1510,
    streakDays: 12,
  },
  {
    handle: "you",
    name: "You",
    tagline: "Just joined. Here to learn, train, build.",
    bio: "New to sof.ai. Your profile is quiet today — by the end of your first module it will be loud. Start a lesson, open a study room, or ship with Devin to fill this wall.",
    location: "—",
    role: "learner",
    pills: ["New here"],
    emoji: "🧑‍🚀",
    avatarGradient: ["#6366f1", "#8b5cf6"],
    accentThird: "#ec4899",
    highlightReel:
      "Nothing shipped yet — but that's the point. Every profile on sof.ai starts empty and fills up as you learn, train, and build alongside agents. Your first build is one click away.",
    joined: new Date().toISOString().slice(0, 10),
    pronouns: "they/them",
    topAgents: ["devin", "claude", "gemini"],
    followers: 0,
    following: 7,
    xp: 0,
    streakDays: 1,
  },
];

export function getPerson(handle: string): Person | undefined {
  const h = handle.toLowerCase().replace(/^@/, "");
  return PEOPLE.find((p) => p.handle === h);
}

export function listPeople(): Person[] {
  return PEOPLE;
}
