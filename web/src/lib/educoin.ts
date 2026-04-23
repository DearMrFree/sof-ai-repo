/**
 * Educoin® client helpers.
 *
 * Educoin® is a registered service mark of InventXR LLC
 * (USPTO Reg. No. 5,935,271, Class 41). Every UI surface that displays
 * the mark should render the ® symbol and at least once per page the
 * full attribution line:
 *
 *   "Educoin® is a registered service mark of InventXR LLC.
 *    USPTO Reg. No. 5,935,271. All rights reserved."
 *
 * Use <EducoinAttribution /> to render it consistently.
 */

export type OwnerType = "user" | "agent";

export interface Wallet {
  owner_type: OwnerType;
  owner_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_sent: number;
  lifetime_received: number;
}

export interface EducoinTx {
  id: number;
  amount: number;
  kind:
    | "earn"
    | "spend"
    | "transfer_in"
    | "transfer_out"
    | "award"
    | "adjustment";
  memo: string;
  counterparty_type: OwnerType | null;
  counterparty_id: string | null;
  correlation_id: string | null;
  created_at: string;
}

export interface EarnRule {
  key: string;
  kind: string;
  amount: number;
  memo: string;
}

export interface TopEarner {
  owner_type: OwnerType;
  owner_id: string;
  earned_last_7d: number;
}

/** Format an EDU balance — always with thousands separators, no decimals. */
export function formatEDU(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.trunc(amount)).toLocaleString()}`;
}

export const EDUCOIN_ATTRIBUTION =
  "Educoin® is a registered service mark of InventXR LLC. USPTO Reg. No. 5,935,271. All rights reserved.";

export const EDUCOIN_TAGLINE =
  "The first USPTO-registered service mark for education-incentive cryptocurrency.";

export async function fetchWallet(
  ownerType: OwnerType,
  ownerId: string,
): Promise<Wallet | null> {
  try {
    const res = await fetch(
      `/api/wallet/${ownerType}/${encodeURIComponent(ownerId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as Wallet;
  } catch {
    return null;
  }
}

export async function fetchTransactions(
  ownerType: OwnerType,
  ownerId: string,
  limit = 20,
): Promise<EducoinTx[]> {
  try {
    const res = await fetch(
      `/api/wallet/${ownerType}/${encodeURIComponent(
        ownerId,
      )}/transactions?limit=${limit}`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as EducoinTx[];
  } catch {
    return [];
  }
}

export async function fetchEarnRules(): Promise<EarnRule[]> {
  try {
    const res = await fetch("/api/wallet/earn-rules", { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as EarnRule[];
  } catch {
    return [];
  }
}

export async function fetchTopEarners(limit = 10): Promise<TopEarner[]> {
  try {
    const res = await fetch(`/api/wallet/top-earners?limit=${limit}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as TopEarner[];
  } catch {
    return [];
  }
}

export interface TransferResult {
  out_tx_id: number;
  in_tx_id: number;
  sender_balance: number;
  recipient_balance: number;
}

export async function sendTransfer(
  recipientType: OwnerType,
  recipientId: string,
  amount: number,
  memo = "",
): Promise<
  { ok: true; data: TransferResult } | { ok: false; error: string }
> {
  try {
    const res = await fetch("/api/wallet/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_type: recipientType,
        recipient_id: recipientId,
        amount,
        memo,
      }),
    });
    if (!res.ok) {
      let detail = "Transfer failed.";
      try {
        const body = (await res.json()) as { error?: string; detail?: string };
        detail = body.error ?? body.detail ?? detail;
      } catch {
        /* fall through */
      }
      return { ok: false, error: detail };
    }
    const data = (await res.json()) as TransferResult;
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error:
        "Couldn't reach the wallet backend. " +
        (err instanceof Error ? err.message : ""),
    };
  }
}
