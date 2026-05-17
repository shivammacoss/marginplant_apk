import { useMemo } from "react";
import { useWalletSummary } from "@features/wallet/hooks/useWallet";
import { useOpenPositions } from "@features/portfolio/hooks/usePositions";
import type { Position } from "@features/portfolio/types/position.types";

export interface LiveWalletKpi {
  ledger: number;
  available: number;
  used: number;
  m2m: number;
  cfRequired: number;
}

/**
 * Live-derived wallet KPIs.
 *
 * Why this hook exists: `/user/wallet/summary` polls every 10 s and
 * `/positions/pnl-summary` every 5 s — too slow for the trader's
 * perception. We need MARGIN USED / M2M to react the same frame as the
 * buy/sell or close tap, and to match the per-position card on screen.
 *
 *   available + used → wallet/summary cache, patched optimistically by
 *                      usePlaceOrder.onMutate + close mutations so the
 *                      strip moves on the same frame as the tap.
 *
 *   m2m → Σ (position.unrealized_pnl + position.realized_pnl) across
 *         every OPEN position. This is the EXACT same calc PortfolioScreen
 *         uses to build the per-row `pnl` field that the position card
 *         and TOTAL P&L card show. Same data source = guaranteed
 *         agreement — no more "card says +31.48, M2M says -0.01" mismatch.
 *
 *         We tried recomputing M2M client-side from live WS ticks
 *         (`(ltp − avg) × qty`) so it would animate tick-by-tick. The
 *         catch: backend may apply FX (USD-quoted instruments), use a
 *         different qty unit (contracts vs lots × lot_size), or run a
 *         legacy ×83 conversion — and our client-side math has no way to
 *         know which path the server took. The 3 s positions poll
 *         delivers a refreshed `unrealized_pnl` from the server (already
 *         FX-aware), so we just sum that. M2M effectively updates every
 *         3 s instead of every tick — acceptable trade-off for never
 *         showing a wrong number.
 *
 *   ledger → available + used. Cash on deposit; ignores live P&L.
 */
export function useLiveWalletKpi(): LiveWalletKpi {
  const wallet = useWalletSummary();
  const openPositions = useOpenPositions();

  const available = Number(wallet.data?.available_balance ?? 0);
  const used = Number(wallet.data?.used_margin ?? 0);
  const ledger = available + used;

  const m2m = useMemo(() => {
    const rows: Position[] = openPositions.data ?? [];
    if (rows.length === 0) return 0;
    let total = 0;
    for (const p of rows) {
      // M2M shows ONLY unrealized P&L for OPEN positions. The realized
      // component has already been credited to `available_balance` (see
      // wallet_service.adjust on the close leg), so including it here
      // double-counts the same profit — once in LEDGER BALANCE and once
      // in M2M. That's the "M2M shows 4 lots' worth even after closing
      // 1 lot" bug — realized from the closed lot kept showing up here.
      total += Number(p.unrealized_pnl) || 0;
    }
    return total;
  }, [openPositions.data]);

  // CF (Carry Forward) Required = the EXTRA cash a user needs to convert
  // every open MIS position to NRML so it can be held overnight. Mirrors
  // the backend's `holding_margin` formula on /active-trades:
  //   MIS  → holding = used × 1.4   ⇒ extra = used × 0.4
  //   NRML → holding = used         ⇒ extra = 0 (already overnight)
  // Computed locally from the same /positions/open data the row cards
  // use, so the strip never disagrees with the per-row holding column.
  const cfRequired = useMemo(() => {
    const rows: Position[] = openPositions.data ?? [];
    if (rows.length === 0) return 0;
    let total = 0;
    for (const p of rows) {
      const isMIS = (p.product_type || "").toUpperCase() === "MIS";
      if (!isMIS) continue;
      total += (Number(p.margin_used) || 0) * 0.4;
    }
    return total;
  }, [openPositions.data]);

  return { ledger, available, used, m2m, cfRequired };
}
