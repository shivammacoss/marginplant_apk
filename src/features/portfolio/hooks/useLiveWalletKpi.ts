import { useMemo } from "react";
import { useWalletSummary } from "@features/wallet/hooks/useWallet";
import { useOpenPositions } from "@features/portfolio/hooks/usePositions";
import { useTickerStore } from "@features/trade/store/ticker.store";
import type { Position } from "@features/portfolio/types/position.types";

/**
 * Per-position live P&L derivation. Same max-abs heuristic the
 * <LivePositionRow> wrapper uses on each row card so the per-row
 * pnl and the aggregate (M2M / TOTAL P&L) stay in lock-step:
 *
 *   • Live tick available + sane avg/qty → recompute
 *       (ltp − avg) × |qty|  (sign flipped for SELL)
 *     and pick whichever of (derived, server) has larger magnitude.
 *     This lets the value tick on every WS push for INR-quoted
 *     instruments while still trusting the server's FX-applied
 *     number for USD-quoted ones once it lands.
 *   • Anything missing (no tick, qty 0, bad avg) → return server.
 *
 * Returns 0 when neither side has a usable number.
 */
export function computeLivePnl(args: {
  serverPnl: number;
  liveLtp: number | null | undefined;
  avg: number;
  // Signed quantity — positive = long, negative = short.
  qty: number;
}): number {
  const { serverPnl, liveLtp, avg, qty } = args;
  if (
    liveLtp == null ||
    !Number.isFinite(liveLtp) ||
    !Number.isFinite(avg) ||
    avg <= 0 ||
    !Number.isFinite(qty) ||
    qty === 0
  ) {
    return Number.isFinite(serverPnl) ? serverPnl : 0;
  }
  const isBuy = qty > 0;
  const derived = (isBuy ? liveLtp - avg : avg - liveLtp) * Math.abs(qty);
  return Math.abs(derived) >= Math.abs(serverPnl) ? derived : serverPnl;
}

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
  // Subscribe to the WS ticker store so M2M repaints on every tick
  // (not just on the 3 s positions poll). The whole `ticks` object
  // is replaced on every setTick (see ticker.store.setTick) so a
  // single tick triggers one re-render here — O(positions) work,
  // negligible for 5–50 rows.
  const ticks = useTickerStore((s) => s.ticks);

  const rawAvailable = Number(wallet.data?.available_balance ?? 0);
  const used = Number(wallet.data?.used_margin ?? 0);
  const ledger = rawAvailable + used;

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
      //
      // Live tick-driven recompute (same helper the row card uses) so
      // M2M moves on every WS push instead of waiting on the 3 s poll.
      const tok = p.instrument_token ? String(p.instrument_token) : "";
      total += computeLivePnl({
        serverPnl: Number(p.unrealized_pnl) || 0,
        liveLtp: tok ? ticks[tok]?.ltp ?? null : null,
        avg: Number(p.avg_price),
        qty: Number(p.quantity),
      });
    }
    return total;
  }, [openPositions.data, ticks]);

  // MARGIN AVAILABLE = Equity − Margin = Bal + M2M − Used
  //                  = (available + used + m2m) − used
  //                  = rawAvailable + m2m
  // User spec: "PNL jo hai mere available se mines hote rahega" — floating
  // loss should erode what's deployable on the next trade. With the raw
  // `available_balance` field the strip never reacted to PnL (only to
  // realized trade events), so traders could keep punching in new orders
  // while their existing positions silently bled out. Folding live M2M
  // into Available matches the WalletStrip on the web user terminal and
  // the standard CFD broker convention.
  const available = rawAvailable + m2m;

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
