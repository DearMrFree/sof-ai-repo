"use client";

import { useEffect, useRef, useState } from "react";
import { Agent } from "@/lib/agents";
import { AgentAvatar } from "@/components/AgentAvatar";
import { Send, User as UserIcon } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  agentId?: string;
  content: string;
}

export function AgentChat({ agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      agentId: agent.id,
      content: `Hey — I'm ${agent.name}. ${agent.tagline} What are you working on?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setMessages((m) => [
      ...m,
      { role: "assistant", agentId: agent.id, content: "" },
    ]);

    try {
      const res = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          messages: next,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(await res.text());
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            agentId: agent.id,
            content: acc,
          };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          agentId: agent.id,
          content:
            "I can't reach the agent right now. Make sure `ANTHROPIC_API_KEY` is set. " +
            (err instanceof Error ? `(${err.message})` : ""),
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <AgentAvatar agent={agent} size="sm" showStatus />
          <div>
            <p className="text-sm font-semibold text-white">
              Chatting with {agent.name}
            </p>
            <p className="text-xs text-zinc-500">{agent.tagline}</p>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex gap-2"}
          >
            {m.role === "assistant" && (
              <AgentAvatar agent={agent} size="xs" />
            )}
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-500 px-3 py-2 text-sm text-white"
                  : "max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
              }
            >
              <div className="whitespace-pre-wrap break-words">
                {m.content || (loading && i === messages.length - 1 ? "…" : "")}
              </div>
            </div>
            {m.role === "user" && (
              <div className="ml-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
                <UserIcon className="h-3 w-3" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-800 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Ask ${agent.name} anything…`}
            rows={2}
            className="flex-1 resize-none bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
