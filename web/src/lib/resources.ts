/**
 * Curated learning resources for video + reading recommendations.
 *
 * Seeded from Dr. Freedom Cheteni's "Complete Claude AI Learning Document"
 * and extended as the curriculum grows. Entries are tagged so the video
 * recommender (/api/recommend-video) can match them to the learner's
 * current lesson/program/challenge without calling an LLM for every
 * request. LLM-based ranking layers on top when curated matches are
 * thin.
 *
 * Adding a resource:
 *   - pick the tightest tag set you can (5 tags max).
 *   - keep titles ≤ 80 chars.
 *   - prefer stable channels; flag anything ephemeral.
 */
export type ResourceKind = "video" | "repo" | "guide" | "book" | "doc";

export interface Resource {
  id: string;
  kind: ResourceKind;
  title: string;
  url: string;
  /** Short "why this helps you" blurb (≤ 140 chars). */
  blurb: string;
  /** Lowercase tags; both topic ("claude-code", "mcp") and audience ("beginner", "advanced"). */
  tags: string[];
  /** ISO date the resource was added. Helps surface fresh-enough material. */
  addedAt: string;
  /** Optional — duration hint for videos, e.g. "30m", "1h", "playlist". */
  duration?: string;
  /** Optional — attribution line shown in the UI. */
  source?: string;
}

export const RESOURCES: Resource[] = [
  /* ===================== Claude ===================== */
  {
    id: "yt-mastering-claude-code-30m",
    kind: "video",
    title: "Mastering Claude Code in 30 Minutes",
    url: "https://www.youtube.com/watch?v=6eBSHbLKuN0",
    blurb:
      "Fastest overview of Claude Code — shell tool, file edits, PR loop. Watch before your first Claude Code session.",
    tags: ["claude", "claude-code", "ai-pairing", "beginner"],
    addedAt: "2026-04-23",
    duration: "30m",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "yt-claude-full-course-1h",
    kind: "video",
    title: "Claude FULL COURSE 1 HOUR (Build & Automate Anything)",
    url: "https://www.youtube.com/watch?v=KrKhfm2Xuho",
    blurb:
      "Long-form walkthrough — good when you want one cohesive intro instead of scattered tips.",
    tags: ["claude", "claude-code", "automation", "beginner"],
    addedAt: "2026-04-23",
    duration: "1h",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "yt-36-claude-tips",
    kind: "video",
    title: "36 Claude Tips for Beginners (Become a PRO!)",
    url: "https://www.youtube.com/watch?v=9vM4p9NN0Ts",
    blurb:
      "High-density tip reel. Skim for 2–3 habits to try in your next session.",
    tags: ["claude", "productivity", "beginner", "tips"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "yt-automate-any-task-playlist",
    kind: "video",
    title: "Automate Any Task Using Claude! (Full Workflow Playlist)",
    url: "https://www.youtube.com/playlist?list=PLtPgUfajvh_YNdUozVRM15RLYAMG5x_h6",
    blurb:
      "Playlist of concrete workflow automations. Good when you're trying to automate a specific kind of task.",
    tags: ["claude", "automation", "workflow"],
    addedAt: "2026-04-23",
    duration: "playlist",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "yt-ultimate-claude-4-1",
    kind: "video",
    title: "Ultimate Claude 4.1 Guide 2026",
    url: "https://www.youtube.com/watch?v=WGbjP8q79i4",
    blurb:
      "Tour of what changed in Claude 4.1. Watch if you already know Claude and want the delta.",
    tags: ["claude", "claude-4", "advanced"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },

  /* Repos */
  {
    id: "gh-claude-code",
    kind: "repo",
    title: "Claude Code (Official)",
    url: "https://github.com/anthropics/claude-code",
    blurb: "The official Claude Code CLI repo. Read the README before you ship anything with it.",
    tags: ["claude", "claude-code", "repo"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "gh-claude-cookbooks",
    kind: "repo",
    title: "Claude Cookbooks",
    url: "https://github.com/anthropics/claude-cookbooks",
    blurb:
      "Anthropic's cookbook of real patterns. The single best place to copy-paste from when prototyping.",
    tags: ["claude", "claude-api", "patterns", "cookbook"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "gh-awesome-claude-skills",
    kind: "repo",
    title: "Awesome Claude Skills",
    url: "https://github.com/travisvn/awesome-claude-skills",
    blurb: "Curated list of Claude Agent Skills. Graze for ideas; fork what fits.",
    tags: ["claude", "agent-skills", "awesome-list"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "gh-claude-agent-sdk",
    kind: "repo",
    title: "Claude Agent SDK",
    url: "https://github.com/anthropics/claude-agent-sdk",
    blurb: "Build agents with Claude. Start here when your app needs its own agent loop.",
    tags: ["claude", "agent-sdk", "advanced"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "gh-superpowers",
    kind: "repo",
    title: "Superpowers for Claude",
    url: "https://github.com/obra/superpowers",
    blurb: "Power-user scripts on top of Claude Code. Useful when stock Claude hits friction.",
    tags: ["claude", "claude-code", "advanced", "tooling"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "gh-claude-d3js-skill",
    kind: "repo",
    title: "Claude D3.js Skill",
    url: "https://github.com/travisvn/claude-d3js-skill",
    blurb: "Example of a Claude skill that makes D3.js charts real. Good reference skill to clone.",
    tags: ["claude", "agent-skills", "d3js", "example"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "gh-loki-mode",
    kind: "repo",
    title: "Loki Mode",
    url: "https://github.com/travisvn/loki-mode",
    blurb: "Experimental prompt mode for Claude. Read for ideas on prompt modes you could build yourself.",
    tags: ["claude", "prompt-modes", "experimental"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "gh-skill-seekers",
    kind: "repo",
    title: "Skill Seekers",
    url: "https://github.com/yusufkaraaslan/Skill_Seekers",
    blurb: "Community-curated Claude Skills with examples and discussion.",
    tags: ["claude", "agent-skills", "community"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },

  /* Guides */
  {
    id: "gd-claude-prompting",
    kind: "guide",
    title: "Claude Prompting Best Practices",
    url: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices",
    blurb: "Anthropic's own prompting playbook. Read this once; return to it monthly.",
    tags: ["claude", "prompting", "guide", "official"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "gd-claude-code-best-practices",
    kind: "guide",
    title: "Claude Code Best Practices",
    url: "https://code.claude.com/docs/en/best-practices",
    blurb: "Official Claude Code best-practices guide. Start here before advanced workflows.",
    tags: ["claude", "claude-code", "guide", "official"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "gd-building-skills",
    kind: "guide",
    title: "The Complete Guide to Building Skills",
    url: "https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf",
    blurb: "PDF-length deep dive on Agent Skills. For when you're shipping your own skill.",
    tags: ["claude", "agent-skills", "guide", "pdf"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "gd-claude-constitution",
    kind: "guide",
    title: "Claude's Constitution",
    url: "https://www.anthropic.com/constitution",
    blurb:
      "What Claude is optimizing for. Worth reading before you design a system that depends on Claude's values.",
    tags: ["claude", "values", "alignment", "official"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "gd-claude-insider",
    kind: "guide",
    title: "Claude Insider Documentation",
    url: "https://www.claudeinsider.com/docs/getting-started",
    blurb: "Community-maintained getting-started docs. Often more practical than the official site.",
    tags: ["claude", "guide", "getting-started", "community"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },

  /* Books */
  {
    id: "bk-mastering-claude-ai",
    kind: "book",
    title: "Mastering Claude AI: Practical Journey from First Prompts to Pro",
    url: "https://www.amazon.com/Mastering-Claude-AI-Practical-Journey/dp/B0FLJFY8BD",
    blurb: "Book-length arc from beginner prompts to production patterns.",
    tags: ["claude", "book", "comprehensive"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "bk-claude-llm-audiobook",
    kind: "book",
    title: "Claude LLM by Anthropic (Audiobook)",
    url: "https://www.chirpbooks.com/audiobooks/claude-llm-by-anthropic-by-et-tu-code",
    blurb: "Audiobook version for commutes and walks.",
    tags: ["claude", "book", "audiobook"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
  {
    id: "bk-ai-engineering-chip-huyen",
    kind: "book",
    title: "AI Engineering by Chip Huyen",
    url: "https://www.oreilly.com/library/view/ai-engineering/9781098166298/",
    blurb:
      "The production-AI book. Canonical reference for the systems work around LLMs — eval, cost, reliability.",
    tags: ["ai-engineering", "production", "book", "claude", "claude-api", "openai"],
    addedAt: "2026-04-23",
    source: "Dr. Freedom's Claude Learning Doc",
  },
];

/**
 * Pick up to `limit` resources whose tags overlap with ANY of the
 * provided tags. Ranking: resources with more matching tags come
 * first; ties broken by recency (addedAt). Deterministic — the same
 * (tags, limit, kindFilter) always yields the same list.
 */
export function pickResources(
  tags: string[],
  limit = 3,
  kindFilter?: ResourceKind[],
): Resource[] {
  const lowered = tags.map((t) => t.toLowerCase());
  const scored = RESOURCES.filter(
    (r) => !kindFilter || kindFilter.includes(r.kind),
  ).map((r) => {
    const score = r.tags.filter((t) => lowered.includes(t.toLowerCase())).length;
    return { r, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.r.addedAt.localeCompare(a.r.addedAt);
    })
    .slice(0, limit)
    .map((s) => s.r);
}
