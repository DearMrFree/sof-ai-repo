"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Agent } from "@/lib/agents";
import { AgentAvatar } from "@/components/AgentAvatar";
import { Plus, Send, User as UserIcon, Users, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface Message {
  id: string;
  role: "user" | "assistant";
  agentId?: string; // required when role === "assistant"
  userName?: string;
  content: string;
}

export function RoomChat({
  initialAgents,
  inviteableAgents,
  topic,
}: {
  initialAgents: Agent[];
  inviteableAgents: Agent[];
  topic: string;
}) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [bench, setBench] = useState<Agent[]>(inviteableAgents);

  const initialMessage: Message = useMemo(
    () => ({
      id: "welcome",
      role: "assistant",
      agentId: agents[0]?.id ?? "claude",
      content:
        agents.length > 0
          ? `We're live. ${agents.map((a) => a.name).join(", ")} are in the room. Ask anything — I'll tee it up.`
          : "You're in! Invite some agents to get started.",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"ask" | "everyone">("ask");
  const [speaker, setSpeaker] = useState<string>(initialAgents[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    if (!speaker && agents[0]) setSpeaker(agents[0].id);
  }, [agents, speaker]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  function invite(agent: Agent) {
    setAgents((a) => [...a, agent]);
    setBench((b) => b.filter((x) => x.id !== agent.id));
  }

  function kick(agent: Agent) {
    setAgents((a) => a.filter((x) => x.id !== agent.id));
    setBench((b) => [...b, agent]);
    if (speaker === agent.id) setSpeaker("");
  }

  async function streamAgent(
    agentId: string,
    prior: Message[],
    onToken: (delta: string) => void,
  ) {
    // Build Claude-compatible message list from the room transcript.
    const apiMessages = prior
      .filter((m) => m.content.trim().length > 0)
      .map((m) => {
        if (m.role === "user") {
          return { role: "user" as const, content: m.content };
        }
        // Other agents' messages are shown to this agent as user messages
        // labeled with the agent name, so the current agent knows who said
        // what in the room.
        if (m.agentId === agentId) {
          return { role: "assistant" as const, content: m.content };
        }
        return {
          role: "user" as const,
          content: `(${m.agentId ?? "other"} said): ${m.content}`,
        };
      });

    const res = await fetch("/api/agent-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        messages: apiMessages,
        context: `You are in a multi-agent study room called "${topic}". Other agents in the room: ${agents
          .filter((a) => a.id !== agentId)
          .map((a) => a.name)
          .join(", ") || "(none)"}. Address the human directly; reference other agents by name when relevant.`,
      }),
    });
    if (!res.ok || !res.body) throw new Error(await res.text());
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      acc += chunk;
      onToken(acc);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const myMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      userName: "You",
    };
    const next: Message[] = [...messages, myMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const respondersIds =
        mode === "everyone"
          ? agents.map((a) => a.id)
          : speaker
            ? [speaker]
            : agents[0]
              ? [agents[0].id]
              : [];
      let running = next;
      for (const agentId of respondersIds) {
        const placeholder: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          agentId,
          content: "",
        };
        running = [...running, placeholder];
        setMessages(running);
        await streamAgent(agentId, running.slice(0, -1), (acc) => {
          setMessages((m) => {
            const copy = [...m];
            const idx = copy.findIndex((x) => x.id === placeholder.id);
            if (idx >= 0)
              copy[idx] = { ...copy[idx], content: acc };
            return copy;
          });
        });
        // Update running reference so next agent sees the finished message.
        running = running.map((m) =>
          m.id === placeholder.id
            ? { ...m, content: (document.getElementById(placeholder.id)?.textContent ?? "") }
            : m,
        );
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          agentId: agents[0]?.id,
          content:
            "Room error: can't reach agents. Set ANTHROPIC_API_KEY. " +
            (err instanceof Error ? `(${err.message})` : ""),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
      <div className="flex h-[calc(100vh-16rem)] min-h-[500px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
        >
          {messages.map((m) => {
            const agent = m.agentId ? agents.find((a) => a.id === m.agentId) ?? initialAgents.find((a) => a.id === m.agentId) : undefined;
            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end gap-2">
                  <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-indigo-500 px-3 py-2 text-sm text-white">
                    <p className="text-xs font-medium text-indigo-100">
                      {m.userName ?? "You"}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words">
                      {m.content}
                    </p>
                  </div>
                  <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
                    <UserIcon className="h-3 w-3" />
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className="flex gap-2">
                {agent ? (
                  <AgentAvatar agent={agent} size="xs" />
                ) : (
                  <div className="h-5 w-5 rounded-md bg-zinc-800" />
                )}
                <div className="max-w-[75%] rounded-2xl rounded-bl-sm bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                  {agent && (
                    <p className="text-xs font-medium" style={{ color: agent.avatarGradient[1] }}>
                      {agent.name}
                    </p>
                  )}
                  <p
                    id={m.id}
                    className="mt-0.5 whitespace-pre-wrap break-words"
                  >
                    {m.content || (loading ? "…" : "")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-zinc-800 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 rounded-lg bg-zinc-900 p-0.5">
              <button
                onClick={() => setMode("ask")}
                className={cn(
                  "rounded-md px-2 py-1 transition",
                  mode === "ask"
                    ? "bg-indigo-500 text-white"
                    : "text-zinc-400 hover:text-white",
                )}
              >
                Ask one
              </button>
              <button
                onClick={() => setMode("everyone")}
                className={cn(
                  "rounded-md px-2 py-1 transition",
                  mode === "everyone"
                    ? "bg-indigo-500 text-white"
                    : "text-zinc-400 hover:text-white",
                )}
              >
                Ask everyone
              </button>
            </div>
            {mode === "ask" && agents.length > 0 && (
              <select
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.emoji}
                  </option>
                ))}
              </select>
            )}
            <span className="ml-auto text-[11px] text-zinc-500">
              {agents.length} agents · streaming
            </span>
          </div>
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
              placeholder={
                agents.length === 0
                  ? "Invite an agent on the right to get started…"
                  : `Message the room…`
              }
              rows={2}
              disabled={agents.length === 0}
              className="flex-1 resize-none bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-zinc-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || agents.length === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
              <Users className="h-4 w-4 text-indigo-400" />
              In the room
            </p>
            <button
              onClick={() => setShowInvite((s) => !s)}
              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <Plus className="h-3 w-3" />
              Invite
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {agents.length === 0 && (
              <p className="text-xs text-zinc-500">No agents yet. Invite one →</p>
            )}
            {agents.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2"
              >
                <AgentAvatar agent={a} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white">
                    {a.name}
                  </p>
                  <p className="truncate text-[10px] text-zinc-500">
                    {a.strengths[0]}
                  </p>
                </div>
                <button
                  onClick={() => kick(a)}
                  className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-900 hover:text-rose-400"
                  aria-label="Remove from room"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {showInvite && bench.length > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-sm font-semibold text-white">Invite an agent</p>
            <div className="mt-3 space-y-2">
              {bench.map((a) => (
                <button
                  key={a.id}
                  onClick={() => invite(a)}
                  className="flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2 text-left transition hover:border-indigo-500/50 hover:bg-zinc-900"
                >
                  <AgentAvatar agent={a} size="xs" showStatus />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white">
                      {a.name}
                    </p>
                    <p className="truncate text-[10px] text-zinc-500">
                      {a.tagline}
                    </p>
                  </div>
                  <Plus className="h-3 w-3 text-indigo-400" />
                </button>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
