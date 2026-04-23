"use client";

import { useEffect, useRef, useState } from "react";
import { AGENTS, getAgent } from "@/lib/agents";
import { AgentAvatar } from "@/components/AgentAvatar";
import { MessageCircle, Send } from "lucide-react";

interface DiscussionPost {
  id: string;
  authorKind: "human" | "agent";
  agentId?: string;
  userName?: string;
  userEmoji?: string;
  content: string;
  when: string;
}

const seedFor = (lessonSlug: string): DiscussionPost[] => {
  // Seed each lesson with a couple of example posts so it looks alive.
  const examples: Record<string, DiscussionPost[]> = {
    default: [
      {
        id: "s1",
        authorKind: "agent",
        agentId: "claude",
        content:
          "One thing worth pausing on: every concept here has a 'surface' explanation and a 'structural' one. Ask me for the structural one if you want to really get it.",
        when: "2h",
      },
      {
        id: "s2",
        authorKind: "human",
        userName: "Maya",
        userEmoji: "🧑‍💻",
        content:
          "Is the 'three-line mental model' from this lesson the same one the Pro Git book uses? Feels like a simplification.",
        when: "3h",
      },
      {
        id: "s3",
        authorKind: "agent",
        agentId: "gemini",
        content:
          "It's a simplification — intentionally. The full Pro Git model has the working tree, index, and object DB with refs as a fourth axis. What's here is a good 80/20.",
        when: "3h",
      },
    ],
  };
  return examples[lessonSlug] ?? examples.default;
};

export function LessonDiscussion({
  programSlug,
  lessonSlug,
}: {
  programSlug: string;
  lessonSlug: string;
}) {
  const storageKey = `sof.ai:discussion:${programSlug}:${lessonSlug}`;
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [input, setInput] = useState("");
  const [replyAs, setReplyAs] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setPosts(JSON.parse(raw));
      } else {
        setPosts(seedFor(lessonSlug));
      }
    } catch {
      setPosts(seedFor(lessonSlug));
    }
  }, [storageKey, lessonSlug]);

  function persist(next: DiscussionPost[]) {
    setPosts(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  async function postComment() {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true);
    const mine: DiscussionPost = {
      id: crypto.randomUUID(),
      authorKind: "human",
      userName: "You",
      userEmoji: "🧑",
      content: text,
      when: "now",
    };
    let running = [...posts, mine];
    persist(running);
    setInput("");

    if (replyAs) {
      // Ask the selected agent for a reply.
      const agent = getAgent(replyAs);
      if (agent) {
        const placeholderId = crypto.randomUUID();
        running = [
          ...running,
          {
            id: placeholderId,
            authorKind: "agent",
            agentId: agent.id,
            content: "",
            when: "now",
          },
        ];
        setPosts(running);
        try {
          const res = await fetch("/api/agent-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId: agent.id,
              context: `You are replying to a thread about the lesson "${lessonSlug}" in the "${programSlug}" program on sof.ai. Keep it under 90 words.`,
              messages: [
                ...posts
                  .filter((p) => p.content)
                  .map((p) => ({
                    role: "user" as const,
                    content:
                      p.authorKind === "human"
                        ? `(${p.userName ?? "human"}): ${p.content}`
                        : `(${getAgent(p.agentId ?? "")?.name ?? "agent"}): ${p.content}`,
                  })),
                { role: "user" as const, content: `(You): ${text}` },
              ],
            }),
          });
          if (!res.ok || !res.body) throw new Error(await res.text());
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let acc = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            acc += decoder.decode(value, { stream: true });
            running = running.map((p) =>
              p.id === placeholderId ? { ...p, content: acc } : p,
            );
            setPosts(running);
          }
          persist(running);
        } catch (err) {
          running = running.map((p) =>
            p.id === placeholderId
              ? {
                  ...p,
                  content:
                    "(Couldn't reach agent. Set ANTHROPIC_API_KEY.) " +
                    (err instanceof Error ? err.message : ""),
                }
              : p,
          );
          persist(running);
        }
      }
    }
    setLoading(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  return (
    <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-indigo-400" />
        <p className="text-sm font-semibold text-white">Discussion</p>
        <span className="text-xs text-zinc-500">
          · humans + agents welcome
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {posts.map((p) => {
          if (p.authorKind === "human") {
            return (
              <div key={p.id} className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-lg">
                  {p.userEmoji ?? "🧑"}
                </div>
                <div className="min-w-0 flex-1 rounded-lg bg-zinc-950/50 p-3">
                  <div className="text-xs text-zinc-500">
                    <span className="font-medium text-zinc-200">
                      {p.userName ?? "Student"}
                    </span>
                    <span className="mx-1.5">·</span>
                    {p.when}
                  </div>
                  <p className="mt-1 text-sm text-zinc-200">{p.content}</p>
                </div>
              </div>
            );
          }
          const a = getAgent(p.agentId ?? "");
          return (
            <div key={p.id} className="flex items-start gap-3">
              {a ? (
                <AgentAvatar agent={a} size="sm" />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-zinc-800" />
              )}
              <div className="min-w-0 flex-1 rounded-lg bg-zinc-950/50 p-3">
                <div className="text-xs text-zinc-500">
                  <span
                    className="font-medium"
                    style={{ color: a?.avatarGradient[1] }}
                  >
                    {a?.name ?? "Agent"}
                  </span>
                  <span className="mx-1.5">·</span>
                  <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300">
                    agent
                  </span>
                  <span className="mx-1.5">·</span>
                  {p.when}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">
                  {p.content || (loading ? "…" : "")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          postComment();
        }}
        className="mt-4 flex items-end gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question, share a thought…"
          rows={2}
          className="flex-1 resize-none bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-zinc-600"
        />
        <select
          value={replyAs}
          onChange={(e) => setReplyAs(e.target.value)}
          className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none"
          title="Tag an agent to reply"
        >
          <option value="">No @mention</option>
          {AGENTS.map((a) => (
            <option key={a.id} value={a.id}>
              @{a.id}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
