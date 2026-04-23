"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  type OwnerType,
  type Wallet,
  fetchWallet,
  formatEDU,
} from "@/lib/educoin";

/**
 * Compact Educoin® balance chip.
 *
 * Renders a coin + live balance, links to /wallet by default. Used in:
 *   - the global Nav (for the signed-in user)
 *   - profile page headers (for any owner)
 *   - school/agent pages (for agent owners)
 *
 * Educoin® is a registered service mark of InventXR LLC.
 */
interface EducoinChipProps {
  ownerType: OwnerType;
  ownerId: string;
  /** Where the chip links to. Defaults to /wallet (own) or the owner's profile (others). */
  href?: string;
  /** Compact skin used in dense surfaces like Nav. */
  size?: "sm" | "md";
  className?: string;
  /** Preloaded wallet — if provided, skip the fetch. */
  initialWallet?: Wallet | null;
}

export function EducoinChip({
  ownerType,
  ownerId,
  href,
  size = "sm",
  className,
  initialWallet,
}: EducoinChipProps) {
  const [wallet, setWallet] = useState<Wallet | null>(initialWallet ?? null);
  const [loading, setLoading] = useState<boolean>(!initialWallet);

  useEffect(() => {
    if (initialWallet || !ownerId) return;
    let cancelled = false;
    fetchWallet(ownerType, ownerId).then((w) => {
      if (cancelled) return;
      setWallet(w);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerType, ownerId, initialWallet]);

  const target = href ?? "/wallet";
  const pad = size === "sm" ? "px-2.5 py-1" : "px-3 py-1.5";
  const text = size === "sm" ? "text-[11px]" : "text-xs";
  const balance = wallet?.balance ?? 0;

  return (
    <Link
      href={target}
      title="Educoin® balance — earned by learning, teaching, and contributing."
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-yellow-400/5 to-amber-500/10 font-medium text-amber-200 shadow-sm shadow-amber-500/10 transition hover:border-amber-400/50 hover:text-amber-100",
        pad,
        text,
        className,
      )}
    >
      <span
        aria-hidden
        className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 text-[8px] font-black text-amber-900 shadow-inner"
      >
        <Coins className="h-2.5 w-2.5" strokeWidth={2.8} />
      </span>
      {loading ? (
        <span className="inline-block h-3 w-8 animate-pulse rounded bg-amber-500/20" />
      ) : (
        <>
          <span className="tabular-nums">{formatEDU(balance)}</span>
          <span className="text-[10px] text-amber-300/70">EDU</span>
        </>
      )}
    </Link>
  );
}

/**
 * Single-line trademark footer. Render once per page wherever Educoin® is displayed.
 */
export function EducoinAttribution({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "text-[10px] leading-relaxed text-zinc-500",
        className,
      )}
    >
      Educoin<sup>®</sup> is a registered service mark of{" "}
      <a
        href="https://www.inventxr.com"
        target="_blank"
        rel="noreferrer"
        className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300"
      >
        InventXR LLC
      </a>
      . USPTO Reg. No. 5,935,271. All rights reserved.
    </p>
  );
}
