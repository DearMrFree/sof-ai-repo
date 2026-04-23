"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { sendTransfer, type OwnerType, formatEDU } from "@/lib/educoin";
import { useToast } from "./Toast";

/**
 * Send-Educoins form for /wallet.
 *
 * Educoin® is a registered service mark of InventXR LLC.
 */
interface TransferFormProps {
  onSuccess?: (newBalance: number) => void;
}

export function TransferForm({ onSuccess }: TransferFormProps) {
  const [recipientType, setRecipientType] = useState<OwnerType>("user");
  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState<number>(10);
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);
  const toast = useToast();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLastSuccess(null);
    if (!recipientId.trim()) {
      setError("Enter a recipient handle or agent id.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    setSubmitting(true);
    const res = await sendTransfer(
      recipientType,
      recipientId.trim(),
      Math.floor(amount),
      memo.trim(),
    );
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      toast.push({ message: `Transfer failed: ${res.error}`, tone: "error" });
      return;
    }
    const msg = `Sent ${formatEDU(Math.floor(amount))} EDU to ${
      recipientType === "agent" ? `${recipientId} (agent)` : `@${recipientId}`
    }.`;
    setLastSuccess(msg);
    toast.push({ message: msg, tone: "success" });
    onSuccess?.(res.data.sender_balance);
    setAmount(10);
    setMemo("");
  }

  return (
    <form
      id="send"
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 via-zinc-950 to-zinc-950 p-5"
    >
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-amber-300/80">
        <Send className="h-3.5 w-3.5" /> Send Educoins
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
        <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
          Recipient type
          <select
            value={recipientType}
            onChange={(e) => setRecipientType(e.target.value as OwnerType)}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
          >
            <option value="user">Human (@handle)</option>
            <option value="agent">Agent (id)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
          Recipient {recipientType === "user" ? "handle" : "id"}
          <input
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            placeholder={recipientType === "user" ? "ada-lovelace" : "devin"}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500/60 focus:outline-none"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
        <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
          Amount (EDU)
          <input
            type="number"
            min={1}
            max={100000}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs tabular-nums text-zinc-100 focus:border-amber-500/60 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
          Memo (optional)
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={280}
            placeholder="thanks for the lesson 🙏"
            className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500/60 focus:outline-none"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-2 text-xs font-semibold text-amber-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-yellow-300 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send className="h-3.5 w-3.5" /> Send {formatEDU(amount)} EDU
          </>
        )}
      </button>

      {lastSuccess ? (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {lastSuccess}
        </div>
      ) : null}
      {error ? (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-300">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      ) : null}
    </form>
  );
}
