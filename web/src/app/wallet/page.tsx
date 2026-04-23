"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  Coins,
  Crown,
  Gift,
  GraduationCap,
  Sparkles,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  type EarnRule,
  type EducoinTx,
  type TopEarner,
  type Wallet,
  fetchEarnRules,
  fetchTopEarners,
  fetchTransactions,
  fetchWallet,
  formatEDU,
} from "@/lib/educoin";
import { EducoinAttribution } from "@/components/EducoinChip";
import { TransferForm } from "@/components/TransferForm";
import { cn } from "@/lib/cn";

/**
 * Educoin® banking dashboard.
 *
 * Educoin® is a registered service mark of InventXR LLC
 * (USPTO Reg. No. 5,935,271, Class 41). This is the canonical
 * UI surface for the in-app economy: balance, transactions,
 * transfers, earn rules, marketplace, leaderboard.
 *
 * Organized as a banking platform — the vocabulary (ledger,
 * statement, transfer, payout, balance, lifetime earned) is
 * deliberate so learners treat this as a real account, not a
 * points system.
 */
export default function WalletPage() {
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const handle = session?.user?.name ?? null;

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txs, setTxs] = useState<EducoinTx[]>([]);
  const [rules, setRules] = useState<EarnRule[]>([]);
  const [top, setTop] = useState<TopEarner[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!userId) return;
    const [w, t, r, lb] = await Promise.all([
      fetchWallet("user", userId),
      fetchTransactions("user", userId, 40),
      fetchEarnRules(),
      fetchTopEarners(8),
    ]);
    setWallet(w);
    setTxs(t);
    setRules(r);
    setTop(lb);
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    refresh();
    // Only refresh once on mount + after transfer; polling deferred.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-12 w-64 animate-pulse rounded bg-zinc-900" />
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-zinc-900" />
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-200">
          <Coins className="h-3.5 w-3.5" />
          Educoin<sup>®</sup>
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-white">
          Learn. Earn. Spend. All in one ledger.
        </h1>
        <p className="mt-3 text-base text-zinc-400">
          Every lesson you complete, module you ship, and challenge you log
          earns Educoins — the first USPTO-registered service mark for
          education-incentive cryptocurrency. Sign in to open your wallet.
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-2 text-sm font-semibold text-amber-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-yellow-300"
        >
          Jump in and start earning
        </Link>
        <EducoinAttribution className="mt-8" />
      </main>
    );
  }

  const balance = wallet?.balance ?? 0;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      {/* Hero banking card */}
      <section className="relative overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-950/50 via-zinc-950 to-zinc-950 p-6 shadow-2xl shadow-amber-900/20">
        <div
          aria-hidden
          className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-amber-400/25 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-yellow-500/10 blur-3xl"
        />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-amber-300/80">
              <Coins className="h-3.5 w-3.5" />
              Educoin<sup>®</sup> account · {handle ?? "You"}
            </div>
            <h1 className="mt-1 text-[11px] text-zinc-500">
              The first USPTO-registered service mark for education-incentive
              cryptocurrency · Reg. No. 5,935,271
            </h1>
          </div>
          <Link
            href="#send"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-500/25"
          >
            <ArrowUpRight className="h-3 w-3" />
            Send Educoins
          </Link>
        </div>

        <div className="relative mt-6 flex items-baseline gap-2">
          {loading ? (
            <div className="h-14 w-64 animate-pulse rounded-md bg-amber-500/10" />
          ) : (
            <>
              <span className="text-6xl font-semibold tabular-nums text-amber-100">
                {formatEDU(balance)}
              </span>
              <span className="text-xl font-medium text-amber-300/70">
                EDU
              </span>
            </>
          )}
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-3">
          <LifetimeCard
            label="Lifetime earned"
            value={wallet?.lifetime_earned ?? 0}
            icon={<Sparkles className="h-3 w-3" />}
          />
          <LifetimeCard
            label="Lifetime received"
            value={wallet?.lifetime_received ?? 0}
            icon={<TrendingUp className="h-3 w-3" />}
          />
          <LifetimeCard
            label="Lifetime sent"
            value={wallet?.lifetime_sent ?? 0}
            icon={<ArrowUpRight className="h-3 w-3" />}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Transfer form */}
          <TransferForm
            onSuccess={() => {
              refresh();
            }}
          />

          {/* Transactions ledger */}
          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                <Coins className="h-3.5 w-3.5" />
                Statement · last {txs.length} entries
              </h2>
              <p className="text-[10px] text-zinc-500">
                Newest first · append-only ledger
              </p>
            </div>
            {txs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-zinc-400">
                  No transactions yet. Complete your first lesson to earn your
                  first Educoins.
                </p>
                <Link
                  href="/learn"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-200 transition hover:text-white"
                >
                  Browse courses
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-900">
                {txs.map((t) => (
                  <TxRow key={t.id} tx={t} />
                ))}
              </ul>
            )}
          </section>

          {/* Marketplace */}
          <MarketplaceCatalog />
        </div>

        <aside className="space-y-6">
          {/* Earn rules */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <GraduationCap className="h-3.5 w-3.5" />
              How to earn
            </h3>
            <ul className="space-y-2 text-[12px]">
              {rules.map((r) => (
                <li
                  key={r.key}
                  className="flex items-start justify-between gap-2"
                >
                  <span className="text-zinc-400">{r.memo}</span>
                  <span className="whitespace-nowrap font-semibold tabular-nums text-amber-300">
                    +{formatEDU(r.amount)} EDU
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Leaderboard */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <Crown className="h-3.5 w-3.5" />
              Top earners · last 7 days
            </h3>
            {top.length === 0 ? (
              <p className="text-[11px] text-zinc-500">
                Be the first to climb the board.
              </p>
            ) : (
              <ul className="space-y-1.5 text-[12px]">
                {top.map((e, idx) => (
                  <li
                    key={`${e.owner_type}-${e.owner_id}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className={cn(
                          "inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
                          idx === 0
                            ? "bg-amber-400 text-amber-950"
                            : idx === 1
                              ? "bg-zinc-300 text-zinc-900"
                              : idx === 2
                                ? "bg-amber-700 text-amber-100"
                                : "bg-zinc-800 text-zinc-400",
                        )}
                      >
                        {idx + 1}
                      </span>
                      <Link
                        href={
                          e.owner_type === "agent"
                            ? `/u/${e.owner_id}`
                            : `/u/${e.owner_id}`
                        }
                        className="truncate text-zinc-200 transition hover:text-white"
                      >
                        {e.owner_type === "agent" ? `${e.owner_id} (agent)` : `@${e.owner_id}`}
                      </Link>
                    </span>
                    <span className="tabular-nums text-amber-300">
                      {formatEDU(e.earned_last_7d)} EDU
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Integrity callout */}
          <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-200">
              <Award className="h-3.5 w-3.5" />
              Trademark integrity
            </h3>
            <p className="text-[11px] leading-relaxed text-amber-100/70">
              Educoin<sup>®</sup> is the only USPTO-registered service mark
              for education-incentive cryptocurrency. Reg. No. 5,935,271 ·
              Class 41. Owner: InventXR LLC (Wyoming).
            </p>
          </section>

          <EducoinAttribution />
        </aside>
      </div>
    </main>
  );
}

function LifetimeCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">
        {formatEDU(value)}
      </div>
    </div>
  );
}

function TxRow({ tx }: { tx: EducoinTx }) {
  const positive = tx.amount >= 0;
  const kindLabels: Record<EducoinTx["kind"], string> = {
    earn: "Earned",
    spend: "Spent",
    transfer_in: "Received",
    transfer_out: "Sent",
    award: "Awarded",
    adjustment: "Adjusted",
  };
  const Icon = positive ? ArrowDownLeft : ArrowUpRight;
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full",
            positive
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-rose-500/15 text-rose-300",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-zinc-100">
            {tx.memo || kindLabels[tx.kind]}
          </p>
          <p className="truncate text-[11px] text-zinc-500">
            {kindLabels[tx.kind]}
            {tx.counterparty_id
              ? ` · ${tx.counterparty_type === "agent" ? tx.counterparty_id : `@${tx.counterparty_id}`}`
              : ""}
            {" · "}
            {new Date(tx.created_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
      <span
        className={cn(
          "whitespace-nowrap text-sm font-semibold tabular-nums",
          positive ? "text-emerald-300" : "text-rose-300",
        )}
      >
        {positive ? "+" : ""}
        {formatEDU(tx.amount)} EDU
      </span>
    </li>
  );
}

function MarketplaceCatalog() {
  const items = [
    {
      icon: <Sparkles className="h-4 w-4" />,
      title: "Upgrade: Devin Teams",
      desc: "Unlock team-scale Devin sessions for your cohort.",
      price: 2500,
      tag: "Upgrade",
    },
    {
      icon: <GraduationCap className="h-4 w-4" />,
      title: "Commission a custom lesson",
      desc: "Pay an agent instructor to build a lesson on your topic.",
      price: 500,
      tag: "Academic",
    },
    {
      icon: <Users className="h-4 w-4" />,
      title: "Sponsor a learner",
      desc: "Fund another learner's capstone — transfers land earmarked.",
      price: 250,
      tag: "Community",
    },
    {
      icon: <Store className="h-4 w-4" />,
      title: "Agent compute pack",
      desc: "Buy a compute minute pack redeemable with any agent.",
      price: 100,
      tag: "Compute",
    },
    {
      icon: <Gift className="h-4 w-4" />,
      title: "Gift a skill tree",
      desc: "Send a pre-curated course bundle to a friend.",
      price: 300,
      tag: "Gift",
    },
  ];
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
          <Store className="h-3.5 w-3.5" />
          Marketplace · preview
        </h2>
        <span className="text-[10px] text-zinc-500">Launching v1 soon</span>
      </div>
      <ul className="grid grid-cols-1 gap-0 divide-y divide-zinc-900 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {items.slice(0, 2).map((item) => (
          <MarketplaceRow key={item.title} {...item} />
        ))}
      </ul>
      <ul className="grid grid-cols-1 divide-y divide-zinc-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:border-t sm:border-zinc-900">
        {items.slice(2).map((item) => (
          <MarketplaceRow key={item.title} {...item} />
        ))}
      </ul>
    </section>
  );
}

function MarketplaceRow({
  icon,
  title,
  desc,
  price,
  tag,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  price: number;
  tag: string;
}) {
  return (
    <li className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
        {icon}
        {tag}
      </div>
      <h4 className="text-sm font-semibold text-zinc-100">{title}</h4>
      <p className="text-[11px] leading-relaxed text-zinc-400">{desc}</p>
      <div className="mt-auto flex items-center justify-between">
        <span className="text-xs font-semibold tabular-nums text-amber-300">
          {formatEDU(price)} EDU
        </span>
        <button
          disabled
          className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[10px] text-zinc-500"
          title="Marketplace v1 is landing soon."
        >
          Soon
        </button>
      </div>
    </li>
  );
}


