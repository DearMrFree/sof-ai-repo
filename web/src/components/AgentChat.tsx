"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Agent,
  agentHasCapability,
  findAgentWithCapability,
  getAgent,
} from "@/lib/agents";
import { AgentAvatar } from "@/components/AgentAvatar";
import { OfficeHoursBadge } from "@/components/OfficeHoursBadge";
import { hasOpenHandoff, parseHandoffs } from "@/lib/handoff";
import {
  ArrowRight,
  ExternalLink,
  Paperclip,
  Rocket,
  Send,
  User as UserIcon,
  X,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  agentId?: string;
  content: string;
  /** When the assistant turn is a file analysis, attach the URL so it
   * stays visible in the thread for re-download. */
  attachment?: { name: string; url: string };
}

interface UploadedFile {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
  name: string;
}

interface DevinSession {
  sessionUrl: string;
  prUrl?: string;
  stub?: boolean;
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
  const [pendingFile, setPendingFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [devinLaunching, setDevinLaunching] = useState(false);
  const [devinError, setDevinError] = useState<string | null>(null);
  const [devinSession, setDevinSession] = useState<DevinSession | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canUpload = agentHasCapability(agent, "file_analysis");
  const canKickoffDevin = agentHasCapability(agent, "devin_kickoff");

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as
        | UploadedFile
        | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      }
      setPendingFile(data);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed",
      );
    } finally {
      setUploading(false);
    }
  }

  async function sendAnalysis(file: UploadedFile, prompt: string) {
    const userMsg: Message = {
      role: "user",
      content: prompt
        ? `${prompt}\n\n📎 ${file.name}`
        : `📎 ${file.name}`,
    };
    setMessages((m) => [
      ...m,
      userMsg,
      {
        role: "assistant",
        agentId: agent.id,
        content: "",
        attachment: { name: file.name, url: file.url },
      },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/files/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          blobUrl: file.url,
          fileName: file.name,
          contentType: file.contentType,
          size: file.size,
          prompt,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(await res.text());
      }
      await streamInto(res.body);
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          agentId: agent.id,
          content: `Couldn't analyze that file: ${
            err instanceof Error ? err.message : "unknown error"
          }`,
          attachment: { name: file.name, url: file.url },
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  async function streamInto(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = {
          role: "assistant",
          agentId: agent.id,
          content: acc,
          attachment: last?.attachment,
        };
        return copy;
      });
    }
    const tail = decoder.decode();
    if (tail) {
      acc += tail;
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = {
          role: "assistant",
          agentId: agent.id,
          content: acc,
          attachment: last?.attachment,
        };
        return copy;
      });
    }
  }

  async function send() {
    const text = input.trim();
    if (loading) return;

    if (pendingFile) {
      const file = pendingFile;
      setPendingFile(null);
      setInput("");
      await sendAnalysis(file, text);
      return;
    }

    if (!text) return;
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
      await streamInto(res.body);
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

  async function launchDevin() {
    setDevinLaunching(true);
    setDevinError(null);
    try {
      // The Devin route expects a programSlug + lessonSlug + prompt + title.
      // We synthesize a sensible default from the latest user turn so the
      // session has actionable framing without an extra modal.
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const prompt =
        lastUser?.content?.trim() ||
        "Pair with the learner on whatever they're stuck on. Open a draft PR if there's real code work to ship.";
      const res = await fetch("/api/devin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug: "office-hours",
          lessonSlug: `chat-${agent.id}`,
          prompt,
          title: `Office hours with ${agent.name}`,
        }),
      });
      const data = (await res.json()) as DevinSession | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      }
      setDevinSession(data);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          agentId: agent.id,
          content: data.stub
            ? `🛠️ Demo Devin session opened (DEVIN_TASKS_ENABLED is off — flip it to launch real sessions): ${data.sessionUrl}`
            : `🚀 Live Devin session: ${data.sessionUrl}`,
        },
      ]);
    } catch (err) {
      setDevinError(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setDevinLaunching(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <AgentAvatar agent={agent} size="sm" showStatus />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">
              Chatting with {agent.name}
            </p>
            <p className="truncate text-xs text-zinc-500">{agent.tagline}</p>
          </div>
        </div>
        {agent.officeHours && (
          <div className="mt-3">
            <OfficeHoursBadge agent={agent} />
          </div>
        )}
        {canKickoffDevin && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={launchDevin}
              disabled={devinLaunching}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              <Rocket className="h-3.5 w-3.5" />
              {devinLaunching ? "Launching…" : "Start a Devin session"}
            </button>
            {devinSession && (
              <a
                href={devinSession.sessionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200"
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
        {devinError && (
          <p className="mt-2 text-xs text-rose-400">{devinError}</p>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.map((m, i) => (
          <ChatBubble
            key={i}
            message={m}
            agent={agent}
            loadingTail={loading && i === messages.length - 1}
          />
        ))}
      </div>

      <div className="space-y-2 border-t border-zinc-800 p-3">
        {canUpload && (
          <FileDropZone
            pendingFile={pendingFile}
            uploading={uploading}
            uploadError={uploadError}
            onFile={uploadFile}
            onClear={() => setPendingFile(null)}
            onPickClick={() => fileInputRef.current?.click()}
          />
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
            e.target.value = "";
          }}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-2"
        >
          {canUpload && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
              title="Attach a file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
          )}
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
              pendingFile
                ? `Optional: tell ${agent.name} what to focus on…`
                : `Ask ${agent.name} anything…`
            }
            rows={2}
            className="flex-1 resize-none bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={loading || (!input.trim() && !pendingFile)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  agent,
  loadingTail,
}: {
  message: Message;
  agent: Agent;
  loadingTail: boolean;
}) {
  const isUser = message.role === "user";
  const segments = isUser ? null : parseHandoffs(message.content);
  const isStreamingHandoff = !isUser && hasOpenHandoff(message.content);

  return (
    <div className={isUser ? "flex justify-end" : "flex gap-2"}>
      {!isUser && <AgentAvatar agent={agent} size="xs" />}
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-500 px-3 py-2 text-sm text-white"
            : "max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
        }
      >
        {message.attachment && (
          <a
            href={message.attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-600"
          >
            <Paperclip className="h-3 w-3" />
            {message.attachment.name}
          </a>
        )}
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">
            {message.content || (loadingTail ? "…" : "")}
          </div>
        ) : (
          <>
            {segments?.map((seg, idx) => {
              if (seg.kind === "handoff") {
                return (
                  <HandoffCard
                    key={idx}
                    target={seg.target}
                    reason={seg.reason}
                    description={seg.text}
                  />
                );
              }
              // While the model is mid-stream emitting an unclosed
              // <HANDOFF…> tag, hide the trailing fragment so users
              // don't see raw markup flicker into view.
              const isTrailing = idx === (segments?.length ?? 0) - 1;
              const text =
                isTrailing && isStreamingHandoff
                  ? seg.text.replace(/<HANDOFF[\s\S]*$/i, "")
                  : seg.text;
              return (
                <div key={idx} className="whitespace-pre-wrap break-words">
                  {text || (loadingTail && idx === 0 ? "…" : "")}
                </div>
              );
            })}
          </>
        )}
      </div>
      {isUser && (
        <div className="ml-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
          <UserIcon className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}

function HandoffCard({
  target,
  reason,
  description,
}: {
  target?: string;
  reason?: string;
  description?: string;
}) {
  const targetAgent = target ? getAgent(target) : undefined;
  // Fall back: if the model named a target we don't know about, look up
  // the right specialist by the reason instead.
  const fallback =
    !targetAgent && reason === "file-analysis"
      ? findAgentWithCapability("file_analysis")
      : !targetAgent && reason === "ship-code"
        ? findAgentWithCapability("devin_kickoff")
        : undefined;
  const a = targetAgent ?? fallback;
  if (!a) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-2 text-xs text-zinc-400">
        {description || "Hand-off recommended."}
      </div>
    );
  }
  return (
    <Link
      href={`/classroom/agents/${a.id}`}
      className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-xs transition hover:border-emerald-500/60 hover:bg-emerald-500/20"
    >
      <AgentAvatar agent={a} size="xs" />
      <div className="flex-1">
        <p className="font-semibold text-emerald-200">
          Hand off to {a.name}
        </p>
        {description && (
          <p className="mt-0.5 text-emerald-200/80">{description}</p>
        )}
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-emerald-200" />
    </Link>
  );
}

function FileDropZone({
  pendingFile,
  uploading,
  uploadError,
  onFile,
  onClear,
  onPickClick,
}: {
  pendingFile: UploadedFile | null;
  uploading: boolean;
  uploadError: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
  onPickClick: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  if (pendingFile) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
        <Paperclip className="h-3.5 w-3.5" />
        <span className="flex-1 truncate font-medium">{pendingFile.name}</span>
        <span className="text-emerald-300/70">
          {formatSize(pendingFile.size)}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="rounded p-0.5 hover:bg-emerald-500/20"
          title="Remove attachment"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={onPickClick}
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition ${
        dragging
          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
          : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
      }`}
    >
      <Paperclip className="h-3.5 w-3.5" />
      {uploading ? (
        <span>Uploading…</span>
      ) : uploadError ? (
        <span className="text-rose-400">{uploadError}</span>
      ) : (
        <span>Drop a file for analysis (PDF, code, transcript, dataset)</span>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
