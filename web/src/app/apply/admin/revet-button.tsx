"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw } from "lucide-react";

export function ReVetButton({ applicationId }: { applicationId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/vet`, {
        method: "POST",
      });
      const data = (await res.json()) as
        | { vet?: { vet_status: string }; emails_sent?: number }
        | { detail?: string; error?: string };
      if (!res.ok) {
        const detail =
          (data as { detail?: string; error?: string }).detail ??
          (data as { error?: string }).error ??
          "Re-vet failed.";
        setErr(typeof detail === "string" ? detail : "Re-vet failed.");
        return;
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Re-vet failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-200 hover:border-fuchsia-500 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCcw className="h-3 w-3" />
        )}
        Re-vet
      </button>
      {err ? <span className="text-xs text-rose-300">{err}</span> : null}
    </span>
  );
}
