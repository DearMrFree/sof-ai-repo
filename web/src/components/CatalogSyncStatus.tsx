"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { APPROVER_EMAIL } from "@/lib/applications/trio";

interface SyncStatus {
  running: boolean;
  total_courses_in_db: number;
  last_started: string | null;
  last_finished: string | null;
  last_synced_count: number;
  last_error: string | null;
}

export function CatalogSyncStatus() {
  const { data: session } = useSession();
  const email = (session?.user as { email?: string })?.email ?? "";
  const isAdmin = email === APPROVER_EMAIL;

  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/catalog/sync");
      if (res.ok) setStatus(await res.json());
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll while a sync is running.
  useEffect(() => {
    if (!status?.running) return;
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, [status?.running, fetchStatus]);

  async function triggerSync(limit = 2600) {
    setSyncing(true);
    try {
      const res = await fetch(`/api/catalog/sync?limit=${limit}`, { method: "POST" });
      if (res.ok) {
        await fetchStatus();
      }
    } finally {
      setSyncing(false);
    }
  }

  if (!status) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
      <span>
        {status.total_courses_in_db.toLocaleString()} courses in catalog
      </span>

      {status.running ? (
        <span className="inline-flex items-center gap-1 text-indigo-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Syncing…
        </span>
      ) : status.last_error ? (
        <span className="inline-flex items-center gap-1 text-red-400">
          <AlertCircle className="h-3 w-3" />
          Sync error
        </span>
      ) : status.last_finished ? (
        <span className="inline-flex items-center gap-1 text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Synced {status.last_synced_count} courses
        </span>
      ) : null}

      {isAdmin && !status.running && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerSync(2600)}
            disabled={syncing}
            className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-400 transition hover:text-white disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            Sync all
          </button>
          <button
            onClick={() => triggerSync(100)}
            disabled={syncing}
            className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-400 transition hover:text-white disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            Quick sync (100)
          </button>
        </div>
      )}
    </div>
  );
}
