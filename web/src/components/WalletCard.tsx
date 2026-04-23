"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Coins, Sparkles, Send, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  type OwnerType,
  type Wallet,
  fetchWallet,
  formatEDU,
} from "@/lib/educoin";
import { EducoinAttribution } from "./EducoinChip";

interface WalletCardProps {
  ownerType: OwnerType;
  ownerId: string;
  /** Display handle / agent id shown above the balance. */
  displayName: string;
  /** True when this wallet belongs to the signed-in viewer. Shows the Send button. */
  canTransfer?: boolean;
  className?: string;
}

/**
 * "Banking-platform" wallet card rendered on profile pages.
 *
 * Educoin® is a registered service mark of InventXR LLC
 * (USPTO Reg. No. 5,935,271, Class 41).
 */
export function WalletCard({
  ownerType,
  ownerId,
  displayName,
  canTransfer = false,
  className,
}: WalletCardProps) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchWallet(ownerType, ownerId).then((w) => {
      if (cancelled) return;
      setWallet(w);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerType, ownerId]);

  const balance = wallet?.balance ?? 0;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 via-zinc-950 to-zinc-950 p-5",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-yellow-500/10 blur-3xl"
      />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-amber-300/80">
          <Coins className="h-3.5 w-3.5" />
          Educoin<sup>®</sup> wallet
        </div>
        <Link
          href="/wallet"
          className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-[10px] text-zinc-400 transition hover:text-white"
        >
          Open banking <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <p className="mt-1 text-[11px] text-zinc-500">
        {displayName}'s ledger · learn, teach, contribute — earn EDU.
      </p>

      <div className="relative mt-4 flex items-baseline gap-2">
        {loading ? (
          <div className="h-10 w-40 animate-pulse rounded-md bg-amber-500/10" />
        ) : (
          <>
            <span className="text-4xl font-semibold tabular-nums text-amber-100">
              {formatEDU(balance)}
            </span>
            <span className="text-lg font-medium text-amber-300/70">EDU</span>
          </>
        )}
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2 text-[11px]">
        <LifetimeStat
          label="Earned"
          value={wallet?.lifetime_earned ?? 0}
          icon={<Sparkles className="h-3 w-3" />}
        />
        <LifetimeStat
          label="Received"
          value={wallet?.lifetime_received ?? 0}
          icon={<TrendingUp className="h-3 w-3" />}
        />
        <LifetimeStat
          label="Sent"
          value={wallet?.lifetime_sent ?? 0}
          icon={<Send className="h-3 w-3" />}
        />
      </div>

      {canTransfer ? (
        <Link
          href="/wallet#send"
          className="relative mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-2 text-xs font-semibold text-amber-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-yellow-300"
        >
          <Send className="h-3.5 w-3.5" />
          Send Educoins
        </Link>
      ) : (
        <p className="relative mt-4 text-[11px] text-zinc-500">
          Sign in and visit your own wallet to send EDU.
        </p>
      )}

      <EducoinAttribution className="relative mt-3" />
    </section>
  );
}

function LifetimeStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-200">
        {formatEDU(value)}
      </div>
    </div>
  );
}
