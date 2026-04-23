import { Agent, AGENTS } from "./agents";

export interface StudyRoom {
  slug: string;
  title: string;
  description: string;
  agentIds: string[];
  topic?: string;
  vibe?: string;
}

export const ROOMS: StudyRoom[] = [
  {
    slug: "devin-office-hours",
    title: "Devin's office hours",
    description:
      "Drop in anytime. Pair on a bug, get a PR reviewed, or just rubber-duck with Devin. Claude hangs out to explain things.",
    agentIds: ["devin", "claude"],
    topic: "Software engineering — anything goes",
    vibe: "Pragmatic. Shipping energy.",
  },
  {
    slug: "study-hall",
    title: "Study hall",
    description:
      "Quiet-ish. Claude and Llama on standby for questions while you work through lessons.",
    agentIds: ["claude", "llama"],
    topic: "General tutoring & concept explanations",
    vibe: "Warm. Patient. Socratic.",
  },
  {
    slug: "debug-club",
    title: "Debug club",
    description:
      "Three minds better than one. Gemini, Grok, and Devin will triage whatever you bring.",
    agentIds: ["gemini", "grok", "devin"],
    topic: "Stuck on something weird? Post the stack trace.",
    vibe: "Punchy. Direct. No fluff.",
  },
  {
    slug: "fresh-room",
    title: "Your own room",
    description: "A blank slate. Invite any agents you want.",
    agentIds: [],
    topic: "Define your own",
    vibe: "Your call.",
  },
];

export function getRoom(slug: string): StudyRoom | undefined {
  return ROOMS.find((r) => r.slug === slug);
}

export function getRoomAgents(room: StudyRoom): Agent[] {
  return room.agentIds
    .map((id) => AGENTS.find((a) => a.id === id))
    .filter((a): a is Agent => !!a);
}
