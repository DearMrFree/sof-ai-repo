/**
 * Builds — the "App Store" content of every profile page.
 *
 * A build is anything someone has produced on sof.ai: a shipped PR, a capstone
 * project, a write-up, a study-room transcript they're proud of, a module
 * summary. v1 is content-driven from this registry. In v2 these become real
 * records in the database, produced automatically as learners ship things.
 */

export type BuildStatus = "shipped" | "in-progress" | "draft";

export type BuildKind =
  | "capstone"
  | "pr"
  | "writeup"
  | "notes"
  | "project"
  | "talk";

export interface Build {
  id: string;
  /** Owner's handle (people.ts handle OR agents.ts id). */
  owner: string;
  title: string;
  tagline: string; // one-line elevator pitch, shows on card
  description: string; // longer
  status: BuildStatus;
  kind: BuildKind;
  /** Cover visual: two gradient colors + emoji */
  cover: {
    gradient: [string, string];
    emoji: string;
  };
  tags: string[];
  collaborators: string[]; // agent ids
  /** Like counts / stars / claps — they're all the same vibe. */
  stars: number;
  comments: number;
  /** Optional external anchor: PR url, doc url, lesson slug. */
  href?: string;
  hrefLabel?: string;
  /** ISO date. */
  updatedAt: string;
  /** Program / course this belongs to. */
  program?: string;
  /** If true, renders as the big "Now building" hero. */
  featured?: boolean;
  progressPct?: number; // 0-100
}

export const BUILDS: Build[] = [
  // --- Dr. Freedom ---
  {
    id: "sof-ai-itself",
    owner: "freedom",
    title: "sof.ai — the classroom of the future",
    tagline:
      "The LMS where humans and agents learn, train, and build together.",
    description:
      "The site you're on. Next.js frontend, FastAPI backend, 9 agents (Devin, Claude, Gemini, ChatGPT, Perplexity, Mistral, Llama, DeepSeek, Grok), multi-agent study rooms, AI-graded assignments, generative profiles. Built in a weekend with Devin pairing the whole way.",
    status: "shipped",
    kind: "project",
    cover: {
      gradient: ["#8b5cf6", "#ec4899"],
      emoji: "🏫",
    },
    tags: ["Next.js", "FastAPI", "Anthropic", "multi-agent", "LMS"],
    collaborators: ["devin", "claude"],
    stars: 412,
    comments: 38,
    href: "https://github.com/DearMrFree/sof-ai-repo",
    hrefLabel: "View repo",
    updatedAt: "2025-10-22",
    featured: true,
    progressPct: 85,
  },
  {
    id: "school-of-ai-manifesto",
    owner: "freedom",
    title: "Why the classroom has to change",
    tagline:
      "A short manifesto on why LMSes from 2012 can't teach 2025 engineers.",
    description:
      "Argues that every assignment should be a PR, every tutor should be an agent with a persona, and every student should graduate with a portfolio of things agents can't do without them.",
    status: "shipped",
    kind: "writeup",
    cover: {
      gradient: ["#22d3ee", "#6366f1"],
      emoji: "📜",
    },
    tags: ["writing", "education", "vision"],
    collaborators: ["claude"],
    stars: 186,
    comments: 24,
    updatedAt: "2025-10-14",
  },
  {
    id: "agent-persona-spec",
    owner: "freedom",
    title: "Agent persona spec v0.3",
    tagline: "How each agent sounds like itself, not like Claude in a costume.",
    description:
      "Living doc specifying voice, strengths, what each agent refuses, and how their system prompts get composed with room context.",
    status: "in-progress",
    kind: "writeup",
    cover: {
      gradient: ["#10b981", "#14b8a6"],
      emoji: "🧩",
    },
    tags: ["agents", "prompt engineering"],
    collaborators: ["claude", "gemini"],
    stars: 92,
    comments: 11,
    updatedAt: "2025-10-20",
    progressPct: 60,
  },

  // --- Ada ---
  {
    id: "ada-health-endpoint",
    owner: "ada",
    title: "Add /health to toy Express server",
    tagline:
      "First capstone: reviewed a Devin-authored PR, merged it, shipped it.",
    description:
      "Devin opened a PR adding a /health endpoint to a toy Express service. My job was to read the diff, catch the missing test, and ship. I found two things: an unused import and a race on boot. Merged with two review comments and a test added.",
    status: "shipped",
    kind: "capstone",
    cover: {
      gradient: ["#f97316", "#ef4444"],
      emoji: "🩺",
    },
    tags: ["Express", "capstone", "code review"],
    collaborators: ["devin", "claude"],
    stars: 54,
    comments: 8,
    href: "/learn/software-engineer/review-a-devin-pr",
    hrefLabel: "See the lesson",
    updatedAt: "2025-10-18",
    program: "Software Engineer",
  },
  {
    id: "ada-auth-refactor",
    owner: "ada",
    title: "Auth refactor spec (WIP with Devin)",
    tagline: "Pulling auth out of a monolith. Devin is drafting the PR.",
    description:
      "Writing the spec together with Devin. Currently at: 'split auth into an auth/ package, keep routes in app/, replace ad-hoc sessions with an interface.' Devin's drafting the first PR against a scratch repo.",
    status: "in-progress",
    kind: "pr",
    cover: {
      gradient: ["#6366f1", "#8b5cf6"],
      emoji: "🔐",
    },
    tags: ["refactor", "auth", "with-Devin"],
    collaborators: ["devin"],
    stars: 23,
    comments: 5,
    updatedAt: "2025-10-22",
    featured: true,
    progressPct: 35,
  },
  {
    id: "ada-notes-day1",
    owner: "ada",
    title: "Day 1 survival notes",
    tagline: "My notes from my first week. Rough. Useful to me. Maybe to you.",
    description:
      "Draft. Will polish once I finish module 1. Currently a dump of 'things I googled and wish I hadn't' and 'agents that saved me that week.'",
    status: "draft",
    kind: "notes",
    cover: {
      gradient: ["#a3a3a3", "#71717a"],
      emoji: "📓",
    },
    tags: ["notes", "day-1"],
    collaborators: ["claude"],
    stars: 3,
    comments: 0,
    updatedAt: "2025-09-16",
  },

  // --- Maya ---
  {
    id: "maya-reading-is-the-job",
    owner: "maya",
    title: "Reading is the job — module 2 summary",
    tagline:
      "Every code-review pattern from module 2, distilled into a pocket reference.",
    description:
      "I kept re-reading the same three lessons. Decided to write the summary I wished existed. Five review patterns, six anti-patterns, two 'you'll catch this one in prod once and never again' tips. Peer-reviewed by Gemini.",
    status: "shipped",
    kind: "writeup",
    cover: {
      gradient: ["#0ea5e9", "#22d3ee"],
      emoji: "📖",
    },
    tags: ["module 2", "reference", "code review"],
    collaborators: ["gemini", "claude"],
    stars: 221,
    comments: 34,
    updatedAt: "2025-10-17",
    program: "Software Engineer",
  },
  {
    id: "maya-pr-hygiene",
    owner: "maya",
    title: "PR hygiene checklist (v1)",
    tagline: "A 12-item checklist for any PR you're about to push.",
    description:
      "Inspired by a Grok hot-take in the study hall. Edited by Claude for nuance. Battle-tested against the 5 last PRs I reviewed.",
    status: "shipped",
    kind: "writeup",
    cover: {
      gradient: ["#14b8a6", "#22c55e"],
      emoji: "✅",
    },
    tags: ["checklist", "PRs", "process"],
    collaborators: ["grok", "claude"],
    stars: 98,
    comments: 14,
    updatedAt: "2025-10-05",
  },
  {
    id: "maya-bring-three-friends",
    owner: "maya",
    title: "Dragging three friends into sof.ai",
    tagline: "Intro kit so you can bring a friend into their first study room.",
    description:
      "In progress. One-pager + screenshots + a script for 'hey try this 30-min thing'. Draft sent to Dr. Freedom for review.",
    status: "in-progress",
    kind: "project",
    cover: {
      gradient: ["#ec4899", "#f97316"],
      emoji: "🤝",
    },
    tags: ["growth", "onboarding"],
    collaborators: ["claude"],
    stars: 17,
    comments: 2,
    updatedAt: "2025-10-21",
    progressPct: 55,
  },

  // --- Jun ---
  {
    id: "jun-hooks-refactor",
    owner: "jun",
    title: "7k-line component tree → hooks (with Devin)",
    tagline: "Devin is mid-refactor. I'm reviewing the diff in real time.",
    description:
      "Got Devin to open a PR that refactors a legacy class-component tree into hooks and co-located state. Reading the diff with Grok in one room and Claude in another. Notes going into a follow-up write-up.",
    status: "in-progress",
    kind: "pr",
    cover: {
      gradient: ["#10b981", "#14b8a6"],
      emoji: "🪝",
    },
    tags: ["React", "refactor", "with-Devin"],
    collaborators: ["devin", "grok", "claude"],
    stars: 76,
    comments: 19,
    updatedAt: "2025-10-22",
    featured: true,
    progressPct: 62,
  },
  {
    id: "jun-usereducer-debate",
    owner: "jun",
    title: "On useReducer — a two-agent argument",
    tagline:
      "Grok says no. Claude says sometimes. I say: read both and make your call.",
    description:
      "Lightly edited transcript of the argument I refereed between Grok and Claude. Useful if you've ever wondered whether hooks are enough or you need a reducer.",
    status: "shipped",
    kind: "writeup",
    cover: {
      gradient: ["#f59e0b", "#ef4444"],
      emoji: "⚔️",
    },
    tags: ["React", "debate", "useReducer"],
    collaborators: ["grok", "claude"],
    stars: 128,
    comments: 46,
    updatedAt: "2025-10-12",
  },

  // --- You ---
  {
    id: "you-first-capstone-draft",
    owner: "you",
    title: "Your first capstone (draft)",
    tagline: "Pick a Devin capstone to pair on. This card becomes the build.",
    description:
      "When you open your first capstone lesson, this tile fills in with the assignment, Devin's draft PR, and your review — plus stars and reactions from the community.",
    status: "draft",
    kind: "capstone",
    cover: {
      gradient: ["#6366f1", "#8b5cf6"],
      emoji: "🚀",
    },
    tags: ["get-started"],
    collaborators: ["devin"],
    stars: 0,
    comments: 0,
    href: "/learn/software-engineer",
    hrefLabel: "Browse capstones",
    updatedAt: new Date().toISOString().slice(0, 10),
    featured: true,
    progressPct: 0,
  },
];

export function buildsFor(ownerHandle: string): Build[] {
  const h = ownerHandle.toLowerCase().replace(/^@/, "");
  return BUILDS.filter((b) => b.owner === h).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function countByStatus(builds: Build[]): Record<BuildStatus, number> {
  return builds.reduce(
    (acc, b) => {
      acc[b.status] = (acc[b.status] ?? 0) + 1;
      return acc;
    },
    { shipped: 0, "in-progress": 0, draft: 0 } as Record<BuildStatus, number>,
  );
}
