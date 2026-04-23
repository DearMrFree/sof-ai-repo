"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function TutorChat({
  lessonTitle,
  lessonContext,
  programTitle,
}: {
  lessonTitle: string;
  lessonContext: string;
  programTitle: string;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hi! I'm your AI tutor for **${lessonTitle}**. Ask me anything about this lesson — I can explain concepts, give hints, walk through examples, or quiz you. What would you like to dig into?`,
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
    // Add placeholder assistant message we'll stream into.
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          lessonTitle,
          lessonContext,
          programTitle,
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Request failed: ${res.status}`);
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
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content:
            "I can't reach the tutor right now. Make sure `ANTHROPIC_API_KEY` is set in your `.env.local`. " +
            (err instanceof Error ? `(${err.message})` : ""),
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-b border-zinc-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">AI Tutor</p>
            <p className="text-xs text-zinc-500">Knows this lesson cold.</p>
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
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-300">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-500 px-3 py-2 text-sm text-white"
                  : "max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
              }
            >
              <div className="whitespace-pre-wrap break-words">{m.content || (loading && i === messages.length - 1 ? "…" : "")}</div>
            </div>
            {m.role === "user" && (
              <div className="ml-2 mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-900 p-3">
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
            placeholder="Ask the tutor anything..."
            rows={2}
            className="flex-1 resize-none bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-2 px-1 text-[10px] text-zinc-600">
          Tutor uses Anthropic Claude. Requires <code>ANTHROPIC_API_KEY</code>.
        </p>
      </div>
    </div>
  );
}
