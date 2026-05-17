import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { HoldingsAPI, PositionsAPI } from "@features/portfolio/api/positions.api";
import type {
  ActiveTrade,
  Holding,
  PnLSummary,
  Position,
} from "@features/portfolio/types/position.types";
import type { Order } from "@features/trade/types/order.types";
import { ApiError } from "@core/api/errors";
import { useUiStore } from "@shared/store/ui.store";
import { useAuthStore } from "@features/auth/store/auth.store";
import { sounds } from "@shared/services/sounds";
import { isInstrumentMarketOpen, marketLabel } from "@shared/utils/marketHours";

const OPEN_KEY = ["positions", "open"] as const;
const CLOSED_KEY = ["positions", "closed"] as const;
const PNL_KEY = ["positions", "pnl-summary"] as const;
const ACTIVE_KEY = ["positions", "active-trades"] as const;
const HOLDINGS_KEY = ["holdings"] as const;

// Module-level "freeze" timestamps — when a close OR place mutation runs,
// we set these so background pollers (refetchInterval) skip firing during
// the freeze window. The optimistic row (insert on place / clear on close)
// stays on screen until the WS push from UserEventsProvider syncs the real
// state. Prevents two distinct race symptoms the user reported:
//   • Close: "row pops back for a split second" — poll lands while
//     matching engine is still processing the close → returns the row.
//   • Place: "new trade appears, disappears for ~1s, then comes back" —
//     poll fires within ~1s of the optimistic insert, server hasn't
//     committed the position yet → poll returns the old list WITHOUT the
//     new row → optimistic row overwritten → next poll has the real
//     row → it pops back. Freezing the poller during the matching
//     window keeps the optimistic insert visible until WS reconciles.
let _openPositionsFreezeUntil = 0;
let _activeTradesFreezeUntil = 0;
const CLOSE_FREEZE_MS = 2500;
const PLACE_FREEZE_MS = 2500;

/**
 * Pause the open-positions + active-trades refetchInterval for ~2.5 s.
 * Called from usePlaceOrder.onMutate so the optimistic row a user just
 * placed isn't overwritten by a poll that lands before the backend's
 * matching engine commits the real position.
 */
export function freezePositionPollersForPlace(): void {
  _openPositionsFreezeUntil = Date.now() + PLACE_FREEZE_MS;
  _activeTradesFreezeUntil = Date.now() + PLACE_FREEZE_MS;
}

// `keepPreviousData` is critical for the close-position UX — without it,
// after the user closes a row, the next scheduled poll briefly sets the
// query to "fetching" and the cached list is invalidated → the optimistic-
// ally cleared row pops back for a split second. With it, the previous
// list stays on screen until the new fetch resolves; the WS push from
// UserEventsProvider replaces it instantly when the matching engine syncs.
//
// Fast polling (3 s for live, 20 s for snapshots) — user wants the app to
// feel snappy, battery is secondary. WS push covers most updates already,
// REST poll is the safety net + reconciles drift.

export function useOpenPositions() {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Position[]>({
    queryKey: OPEN_KEY,
    queryFn: () => PositionsAPI.open(),
    enabled: isAuth,
    staleTime: 2_000,
    // Returns `false` while a close mutation is settling so the
    // optimistically-cleared list isn't overwritten by a poll that lands
    // while the matching engine is still processing.
    refetchInterval: () =>
      Date.now() < _openPositionsFreezeUntil ? false : 3_000,
    placeholderData: keepPreviousData,
  });
}

export function useClosedPositions() {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Position[]>({
    queryKey: CLOSED_KEY,
    queryFn: () => PositionsAPI.closed(),
    enabled: isAuth,
    staleTime: 10_000,
    refetchInterval: 20_000,
    placeholderData: keepPreviousData,
  });
}

export function usePnLSummary() {
  // CRITICAL: must be gated on auth — TradeSheet is pre-mounted globally
  // (see TradeSheetProvider in AppProviders) which means this hook runs on
  // the unauthenticated login/register screens too. Without the gate, the
  // 5-second refetchInterval hit /pnl-summary while logged out, got 401,
  // triggered notifyAuthFailure → router.replace("/(auth)/login") in a
  // loop — that's what made the login page look like it was refreshing.
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return useQuery<PnLSummary>({
    queryKey: PNL_KEY,
    queryFn: () => PositionsAPI.pnlSummary(),
    enabled: isAuth,
    staleTime: 3_000,
    refetchInterval: 5_000,
    placeholderData: keepPreviousData,
  });
}

export function useHoldings() {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Holding[]>({
    queryKey: HOLDINGS_KEY,
    queryFn: () => HoldingsAPI.list(),
    enabled: isAuth,
    staleTime: 15_000,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useActiveTrades() {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return useQuery<ActiveTrade[]>({
    queryKey: ACTIVE_KEY,
    queryFn: () => PositionsAPI.activeTrades(),
    enabled: isAuth,
    staleTime: 2_000,
    refetchInterval: () =>
      Date.now() < _activeTradesFreezeUntil ? false : 3_000,
    placeholderData: keepPreviousData,
  });
}

// Close mutations follow a single fast pattern:
//
//   onMutate  — cancel any in-flight position fetch and apply the optimistic
//               cleanup so the list empties on the same frame as the tap.
//   onSuccess — push one confirmation toast. Do NOT invalidate the positions
//               cache here. `/ws/user` "position" events (UserEventsProvider)
//               invalidate as soon as the matching engine actually flips the
//               rows to CLOSED — instant once backend is done. If the WS is
//               down, the 5 s scheduled refetchInterval reconciles. Invalidat-
//               ing inside onSuccess used to race the matching engine — the
//               refetch landed while the server still showed the row as OPEN
//               and the optimistically-cleared list "came back" for a second
//               (the flicker bug).
//   onError   — roll back the optimistic snapshot.

// Across every close-mutation below: the success toast fires in `onMutate`
// (the same frame as the tap), NOT in `onSuccess` — `onSuccess` waits for
// the HTTP roundtrip which can be 1-2 s on a slow connection. The
// optimistic UI + WS push handle the real-data sync, so the toast can
// confirm the user's action instantly. If the backend actually rejects,
// `onError` rolls back the cache and pushes a red error toast (which
// supersedes the green one visually since toasts stack).
//
// IMPORTANT — we DON'T `await` qc.cancelQueries before the optimistic
// setQueryData. The await blocks until any in-flight refetch finishes
// (could be ~500ms-1s on a slow connection) — exactly the "1-sec lag
// before the row disappears" bug the user reported. Firing cancel
// without awaiting still cancels any in-flight fetches; the freeze
// window prevents new ones from starting; and `setQueryData` runs
// synchronously so the optimistic update commits in the same frame.

// Deferred re-sync of the Closed-positions tab. The backend's matching
// engine takes ~500-1500 ms to actually flip a position to CLOSED and
// write it to /positions/closed. Refetching too early returns stale
// data; refetching too late looks broken. 2 s hits the sweet spot.
function scheduleClosedSync(qc: ReturnType<typeof useQueryClient>): void {
  setTimeout(() => {
    void qc.invalidateQueries({ queryKey: CLOSED_KEY });
    void qc.invalidateQueries({ queryKey: PNL_KEY });
  }, 2_000);
}

/**
 * Insert a synthetic CLOSED copy of the position we just squared off
 * into the CLOSED_KEY cache so the user sees the row land on the Closed
 * tab on the SAME FRAME as the tap — no waiting on the 2 s backend
 * settle + REST refetch. The matching engine's eventual /ws/user push
 * (or the deferred refetch at 2 s) overwrites this stub with the real
 * closed row carrying the authoritative realized_pnl / closed_at /
 * close_reason. Returns the previous snapshot for rollback on error.
 */
function insertOptimisticClosedPosition(
  qc: QueryClient,
  closing: Position,
  closeReason: string = "USER",
): Position[] | undefined {
  const prev = qc.getQueryData<Position[]>(CLOSED_KEY);
  const nowIso = new Date().toISOString();
  // Roll unrealized into realized so the row shows real P&L instead of
  // 0 in the brief window before WS sync. Backend will replace with the
  // authoritative number a moment later.
  const realizedSnapshot =
    Number(closing.realized_pnl ?? 0) +
    Number(closing.unrealized_pnl ?? 0);
  const optimisticClosed: Position = {
    ...closing,
    // Mark the synthetic row so we can dedupe against the eventual
    // real row when WS push lands.
    id: `tmp-closed-${closing.id}-${Date.now()}`,
    status: "CLOSED",
    quantity: 0,
    // Preserve the size the user actually traded so the Closed-tab card
    // shows the right qty/lots pill instead of "×0".
    opening_quantity:
      closing.opening_quantity ?? Math.abs(closing.quantity ?? 0),
    realized_pnl: String(realizedSnapshot),
    unrealized_pnl: "0",
    margin_used: "0",
    closed_at: nowIso,
    close_reason: closeReason,
  } as Position;
  // Newest-first — matches the backend's `-closed_at` sort order so the
  // row lands at the top of the Closed tab.
  qc.setQueryData<Position[]>(CLOSED_KEY, (cur) => {
    const list = cur ?? [];
    return [optimisticClosed, ...list];
  });
  return prev;
}

/**
 * Roll back any optimistic Closed-tab insertion on mutation failure.
 */
function restoreClosedCache(
  qc: QueryClient,
  snapshot: Position[] | undefined,
): void {
  if (snapshot === undefined) return;
  qc.setQueryData<Position[]>(CLOSED_KEY, snapshot);
}

// Build a synthetic optimistic close order so the Orders tab shows the
// close request the moment the user taps Close — same way usePlaceOrder
// inserts an optimistic order for fresh BUY/SELL taps. Mutations call
// this from `onMutate` so the row appears on the same frame as the tap.
function makeOptimisticCloseOrder(input: {
  symbol: string;
  instrument_token: string;
  product_type: string;
  positionQty: number;
  lotsHint?: number;
}): Order {
  const now = new Date().toISOString();
  // Closing a LONG → SELL order. Closing a SHORT → BUY order.
  const closeAction: "BUY" | "SELL" = input.positionQty > 0 ? "SELL" : "BUY";
  const lots = input.lotsHint ?? (Math.abs(input.positionQty || 0) || 1);
  return {
    id: `tmp-close-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user_id: "",
    symbol: input.symbol,
    token: input.instrument_token,
    action: closeAction,
    order_type: "MARKET",
    product_type: input.product_type as Order["product_type"],
    lots,
    quantity: 0,
    filled_quantity: 0,
    pending_quantity: 0,
    price: "0",
    trigger_price: "0",
    average_price: "0",
    status: "PENDING",
    created_at: now,
  };
}

// Insert an optimistic order row into every cached `["orders", ...]` page
// so the Orders tab paints it instantly. Returns a snapshot map for
// rollback on error.
function insertOptimisticOrder(
  qc: QueryClient,
  order: Order,
): Map<readonly unknown[], Order[] | undefined> {
  const allOrderPages = qc.getQueriesData<Order[]>({ queryKey: ["orders"] });
  const snapshot = new Map<readonly unknown[], Order[] | undefined>();
  for (const [key, value] of allOrderPages) {
    snapshot.set(key, value);
    if (Array.isArray(value)) {
      qc.setQueryData<Order[]>(key, [order, ...value]);
    }
  }
  return snapshot;
}

function rollbackOrders(
  qc: QueryClient,
  snapshot: Map<readonly unknown[], Order[] | undefined> | undefined,
): void {
  if (!snapshot) return;
  snapshot.forEach((value, key) => {
    qc.setQueryData(key, value);
  });
}

// Optimistically release the margin held by `positions` back into the
// wallet's available balance, so the LEDGER / MARGIN AVAILABLE / MARGIN
// USED KPIs on Portfolio repaint the same frame as the close tap.
// Mirrors what backend's wallet_service.release_margin does after the
// matching engine flips a position to CLOSED — the /ws/user `wallet`
// event arrives within ~200-500 ms with the precise number and replaces
// this estimate. Returns the previous wallet snapshot for rollback.
const WALLET_SUMMARY_KEY = ["wallet", "summary"] as const;
type WalletSummaryShape = {
  available_balance?: string;
  used_margin?: string;
  realized_pnl?: string;
  [k: string]: unknown;
};

/**
 * Scale every qty-dependent field on a Position down proportionally
 * when a partial close happens. Without this, `unrealized_pnl`, `lots`,
 * and `margin_used` keep their pre-close (full-quantity) values while
 * `quantity` shrinks — so the position card shows "1 lot · −₹1706 P&L"
 * when it should be "1 lot · −₹853 P&L". Used by both the active-trade
 * close path and the position partial-squareoff path. The next REST/WS
 * refetch overwrites these with the backend's authoritative numbers
 * within ~3 s; this only governs the optimistic render in between.
 */
function scalePartialClose(
  prev: Position,
  newSignedQty: number,
): Position {
  const prevAbs = Math.abs(prev.quantity ?? 0);
  const nextAbs = Math.abs(newSignedQty);
  const scale = prevAbs > 0 ? nextAbs / prevAbs : 1;
  const scaleStr = (v: unknown): string | undefined => {
    if (v == null) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n)) return undefined;
    return String(n * scale);
  };
  const nextLots =
    prev.lots != null && Number.isFinite(Number(prev.lots))
      ? Number(prev.lots) * scale
      : prev.lots;
  const scaledUnrealized = scaleStr(prev.unrealized_pnl);
  const scaledMargin = scaleStr(prev.margin_used);
  return {
    ...prev,
    quantity: newSignedQty,
    lots: nextLots,
    ...(scaledUnrealized !== undefined
      ? { unrealized_pnl: scaledUnrealized }
      : {}),
    ...(scaledMargin !== undefined ? { margin_used: scaledMargin } : {}),
  };
}

function releaseMarginOptimistically(
  qc: QueryClient,
  positions: Position[],
): WalletSummaryShape | undefined {
  const prev = qc.getQueryData<WalletSummaryShape>(WALLET_SUMMARY_KEY);
  if (!prev || positions.length === 0) return prev;
  let releasedMargin = 0;
  let realizedPnl = 0;
  for (const p of positions) {
    releasedMargin += Number(p.margin_used) || 0;
    // Treat the unrealized P&L at close-time as realized — the actual
    // settled P&L only differs by a tiny commission delta which the WS
    // push will correct.
    realizedPnl += Number(p.unrealized_pnl) || 0;
  }
  if (releasedMargin <= 0 && realizedPnl === 0) return prev;
  const nextAvail =
    Number(prev.available_balance ?? 0) + releasedMargin + realizedPnl;
  const nextUsed = Math.max(0, Number(prev.used_margin ?? 0) - releasedMargin);
  const nextRealized = Number(prev.realized_pnl ?? 0) + realizedPnl;
  qc.setQueryData<WalletSummaryShape>(WALLET_SUMMARY_KEY, {
    ...prev,
    available_balance: String(nextAvail),
    used_margin: String(nextUsed),
    realized_pnl: String(nextRealized),
  });
  return prev;
}

export function useCloseActiveTrade() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (tradeId: string) => PositionsAPI.closeActiveTrade(tradeId),
    onMutate: (tradeId) => {
      // Fire-and-forget cancels on all caches we patch — Orders tab
      // refresh too, since we'll insert an optimistic close order.
      void qc.cancelQueries({ queryKey: ACTIVE_KEY });
      void qc.cancelQueries({ queryKey: OPEN_KEY });
      void qc.cancelQueries({ queryKey: ["orders"] });

      const activeSnap = qc.getQueryData<ActiveTrade[]>(ACTIVE_KEY);
      const openSnap = qc.getQueryData<Position[]>(OPEN_KEY);

      // Find the trade being closed BEFORE we mutate, so we can shrink
      // the matching position by its quantity AND build a properly-
      // labelled optimistic close order.
      const closingTrade = activeSnap?.find((t) => t.id === tradeId);

      // ── Market-closed pre-check ─────────────────────────────────
      // Same gate as `useSquareoffPosition` — abort before any cache
      // mutation so the "row vanishes for 1 sec then comes back"
      // flicker can't happen when market is closed.
      if (
        closingTrade &&
        !isInstrumentMarketOpen(
          closingTrade.segment ?? closingTrade.exchange,
          closingTrade.exchange,
        )
      ) {
        const label = marketLabel(
          closingTrade.segment ?? closingTrade.exchange,
          closingTrade.exchange,
        );
        pushToast({
          kind: "warn",
          message: `${label} market is closed — try closing during trading hours.`,
          ttlMs: 4000,
        });
        throw new ApiError(`${label} market is closed`, "MARKET_CLOSED");
      }

      // ─── Active trades cache ────────────────────────────────────────
      qc.setQueryData<ActiveTrade[]>(ACTIVE_KEY, (prev) =>
        prev ? prev.filter((t) => t.id !== tradeId) : prev,
      );

      // ─── Open positions cache ───────────────────────────────────────
      if (closingTrade) {
        qc.setQueryData<Position[]>(OPEN_KEY, (prev) => {
          if (!prev) return prev;
          return prev
            .map((p) => {
              if (
                p.instrument_token !== closingTrade.instrument_token ||
                p.product_type !== closingTrade.product_type
              ) {
                return p;
              }
              const direction = Math.sign(p.quantity || 0) || 1;
              const reducedQty = (closingTrade.quantity || 0) * direction;
              const next = (p.quantity ?? 0) - reducedQty;
              if (Math.abs(next) < 1e-9) return null;
              // Scale unrealized_pnl / lots / margin_used to match the
              // new partial quantity. See scalePartialClose for the
              // "active trade close me dono lot ka P&L dikh rha" bug
              // this prevents.
              return scalePartialClose(p, next);
            })
            .filter((p): p is Position => p != null);
        });
      }

      // ─── Orders cache ────────────────────────────────────────────────
      // Insert a synthetic close-order row so Orders → Open paints the
      // close request on the same frame as the tap. Backend MARKET fill
      // will move it to Executed within ~500 ms via WS push.
      let prevOrders: Map<readonly unknown[], Order[] | undefined> | undefined;
      if (closingTrade) {
        const optOrder = makeOptimisticCloseOrder({
          symbol: closingTrade.symbol,
          instrument_token: closingTrade.instrument_token,
          product_type: closingTrade.product_type,
          // Opposite direction of the trade we're closing.
          positionQty: closingTrade.action === "BUY"
            ? closingTrade.quantity
            : -closingTrade.quantity,
          lotsHint: closingTrade.lots,
        });
        prevOrders = insertOptimisticOrder(qc, optOrder);
      }

      // ─── Wallet cache ───────────────────────────────────────────────
      // Release the parent position's margin so MARGIN AVAILABLE jumps up
      // and MARGIN USED drops on the same frame as the tap.
      let prevWallet: WalletSummaryShape | undefined;
      let prevClosed: Position[] | undefined;
      if (closingTrade) {
        const parent = openSnap?.find(
          (p) =>
            p.instrument_token === closingTrade.instrument_token &&
            p.product_type === closingTrade.product_type,
        );
        if (parent) {
          prevWallet = releaseMarginOptimistically(qc, [parent]);
          // If this active-trade close fully flattens the parent
          // position, surface the row on the Closed tab immediately
          // — instant Closed-tab insertion to match what the user
          // expects (was 1-2 s delay before the REST refetch landed).
          const dirSign = Math.sign(parent.quantity || 0) || 1;
          const reducedQty = (closingTrade.quantity || 0) * dirSign;
          const wouldBeRemaining = (parent.quantity ?? 0) - reducedQty;
          if (Math.abs(wouldBeRemaining) < 1e-9) {
            prevClosed = insertOptimisticClosedPosition(qc, parent);
          }
        } else {
          prevWallet = qc.getQueryData<WalletSummaryShape>(WALLET_SUMMARY_KEY);
        }
      }

      _activeTradesFreezeUntil = Date.now() + CLOSE_FREEZE_MS;
      _openPositionsFreezeUntil = Date.now() + CLOSE_FREEZE_MS;
      sounds.close();
      pushToast({ kind: "success", message: "Trade closed", ttlMs: 1500 });
      return { activeSnap, openSnap, prevOrders, prevWallet, prevClosed };
    },
    onSuccess: () => {
      // After the HTTP returns 200, the matching engine has flipped (or
      // is about to flip) the parent position to CLOSED. Give the engine
      // 2 s and then refetch the Closed tab + pnl-summary so the row
      // surfaces. WS push from UserEventsProvider usually beats this,
      // but the timer is the fallback for slow / disconnected WS.
      scheduleClosedSync(qc);
    },
    onError: (e: ApiError, _vars, ctx) => {
      // Restore ALL caches we patched.
      if (ctx?.activeSnap !== undefined) qc.setQueryData(ACTIVE_KEY, ctx.activeSnap);
      if (ctx?.openSnap !== undefined) qc.setQueryData(OPEN_KEY, ctx.openSnap);
      if (ctx?.prevWallet !== undefined) {
        qc.setQueryData(WALLET_SUMMARY_KEY, ctx.prevWallet);
      }
      restoreClosedCache(qc, ctx?.prevClosed);
      rollbackOrders(qc, ctx?.prevOrders);
      _activeTradesFreezeUntil = 0;
      _openPositionsFreezeUntil = 0;
      pushToast({ kind: "error", message: e.message });
    },
  });
}

export function useSquareoffAll() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    // Custom mutation function: read the current OPEN_KEY snapshot, split
    // into tradable (market-open) vs blocked (market-closed) groups, fire
    // a single squareoff per tradable row. Backend's bulk endpoint had no
    // market-hours guard — tapping "Close All" with MCX positions at 2 AM
    // would force-close them anyway (the bug the user reported). Doing
    // the filter client-side AND calling individual squareoffs gives us
    // both predictable per-row behaviour and a clear blocked-count.
    mutationFn: async () => {
      const openSnap = qc.getQueryData<Position[]>(OPEN_KEY) ?? [];
      const tradable: Position[] = [];
      const blockedLabels = new Set<string>();
      for (const p of openSnap) {
        if (Math.abs(p.quantity || 0) <= 0) continue;
        if (isInstrumentMarketOpen(p.segment_type, p.exchange)) {
          tradable.push(p);
        } else {
          blockedLabels.add(marketLabel(p.segment_type, p.exchange));
        }
      }
      if (tradable.length === 0) {
        // Nothing to do — every open position is on a closed market.
        // Surface ALL blocked-market labels so the user knows why
        // nothing happened (no silent no-op).
        const labels = Array.from(blockedLabels).join(", ");
        pushToast({
          kind: "warn",
          message: labels
            ? `${labels} market is closed — nothing to square off`
            : "Markets are closed — try during trading hours",
          ttlMs: 3500,
        });
        throw new ApiError(
          "All markets closed for open positions",
          "MARKET_CLOSED_ALL",
        );
      }
      // Fire per-row squareoffs in parallel — much faster than serial and
      // the backend handles each independently. Promise.allSettled so one
      // row's hold-time / validation rejection doesn't block the rest.
      const results = await Promise.allSettled(
        tradable.map((p) => PositionsAPI.squareoff(p.id)),
      );
      let placed = 0;
      let failed = 0;
      for (const r of results) {
        if (r.status === "fulfilled") placed += 1;
        else failed += 1;
      }
      return {
        squared_off: placed,
        total: tradable.length,
        blocked_by_hold_time: failed,
        // Surface the market-closed list so the toast in onSuccess can
        // mention which segments were skipped.
        blocked_markets: Array.from(blockedLabels),
      };
    },
    onMutate: () => {
      void qc.cancelQueries({ queryKey: OPEN_KEY });
      void qc.cancelQueries({ queryKey: ACTIVE_KEY });
      void qc.cancelQueries({ queryKey: ["orders"] });
      const openSnap = qc.getQueryData<Position[]>(OPEN_KEY) ?? [];
      const activeSnap = qc.getQueryData<ActiveTrade[]>(ACTIVE_KEY);

      // Same split as mutationFn — only optimistically remove tradable
      // (market-open) positions. Market-closed positions stay on the
      // Position tab so the user can see they weren't touched.
      const tradable: Position[] = [];
      const blocked: Position[] = [];
      for (const p of openSnap) {
        if (Math.abs(p.quantity || 0) <= 0) continue;
        if (isInstrumentMarketOpen(p.segment_type, p.exchange)) tradable.push(p);
        else blocked.push(p);
      }
      if (tradable.length === 0) {
        // No optimistic mutation when there's nothing to do — the
        // mutationFn will throw MARKET_CLOSED_ALL and onError handles
        // the toast. Returning undefined skips rollback.
        return undefined;
      }

      const tradableIds = new Set(tradable.map((p) => p.id));
      qc.setQueryData<Position[]>(OPEN_KEY, (prev) =>
        (prev ?? []).filter((p) => !tradableIds.has(p.id)),
      );
      // Active trades whose parent is in `tradable` — drop them too.
      const tradableTokens = new Set(
        tradable.map((p) => `${p.instrument_token}|${p.product_type}`),
      );
      qc.setQueryData<ActiveTrade[]>(ACTIVE_KEY, (prev) =>
        (prev ?? []).filter(
          (t) => !tradableTokens.has(`${t.instrument_token}|${t.product_type}`),
        ),
      );

      // ─── Orders cache ────────────────────────────────────────────────
      const allOrderPages = qc.getQueriesData<Order[]>({ queryKey: ["orders"] });
      const prevOrders = new Map<readonly unknown[], Order[] | undefined>();
      for (const [key, value] of allOrderPages) {
        prevOrders.set(key, value);
      }
      const closeOrders: Order[] = tradable.map((p) =>
        makeOptimisticCloseOrder({
          symbol: p.symbol,
          instrument_token: p.instrument_token,
          product_type: p.product_type,
          positionQty: p.quantity,
        }),
      );
      if (closeOrders.length > 0) {
        for (const [key, value] of allOrderPages) {
          if (Array.isArray(value)) {
            qc.setQueryData<Order[]>(key, [...closeOrders, ...value]);
          }
        }
      }

      // ─── Wallet cache ───────────────────────────────────────────────
      const prevWallet = releaseMarginOptimistically(qc, tradable);

      // ─── Closed-tab cache ───────────────────────────────────────────
      const prevClosed = qc.getQueryData<Position[]>(CLOSED_KEY);
      const nowIso = new Date().toISOString();
      const fakeClosed: Position[] = tradable.map((p) => ({
        ...p,
        id: `tmp-closed-${p.id}-${Date.now()}`,
        status: "CLOSED",
        quantity: 0,
        opening_quantity:
          p.opening_quantity ?? Math.abs(p.quantity ?? 0),
        realized_pnl: String(
          Number(p.realized_pnl ?? 0) + Number(p.unrealized_pnl ?? 0),
        ),
        unrealized_pnl: "0",
        margin_used: "0",
        closed_at: nowIso,
        close_reason: "USER",
      })) as Position[];
      qc.setQueryData<Position[]>(CLOSED_KEY, (cur) => [
        ...fakeClosed,
        ...(cur ?? []),
      ]);

      _openPositionsFreezeUntil = Date.now() + CLOSE_FREEZE_MS * 2;
      _activeTradesFreezeUntil = Date.now() + CLOSE_FREEZE_MS * 2;
      sounds.close();
      const blockedLabels = new Set<string>();
      for (const p of blocked) blockedLabels.add(marketLabel(p.segment_type, p.exchange));
      pushToast({
        kind: "success",
        message:
          blocked.length > 0
            ? `Closing ${tradable.length} · ${Array.from(blockedLabels).join(", ")} closed`
            : `Closing ${tradable.length} positions`,
        ttlMs: 1800,
      });
      return { openSnap, activeSnap, prevOrders, prevWallet, prevClosed };
    },
    onSuccess: (res) => {
      const blocked = res.blocked_by_hold_time;
      if (blocked > 0) {
        pushToast({
          kind: "warn",
          message: `${blocked} blocked by hold-time`,
        });
      }
      // Defer-invalidate Closed + pnl-summary so newly-closed positions
      // surface in the Closed tab once the matching engine settles.
      scheduleClosedSync(qc);
    },
    onError: (e: ApiError, _vars, ctx) => {
      // Skip rollback when ctx is undefined — that's the "everything was
      // market-closed, nothing was mutated" early return from onMutate.
      if (!ctx) return;
      if (ctx.openSnap !== undefined) qc.setQueryData(OPEN_KEY, ctx.openSnap);
      if (ctx.activeSnap !== undefined) qc.setQueryData(ACTIVE_KEY, ctx.activeSnap);
      if (ctx.prevWallet !== undefined) {
        qc.setQueryData(WALLET_SUMMARY_KEY, ctx.prevWallet);
      }
      restoreClosedCache(qc, ctx.prevClosed);
      rollbackOrders(qc, ctx.prevOrders);
      _openPositionsFreezeUntil = 0;
      _activeTradesFreezeUntil = 0;
      pushToast({ kind: "error", message: e.message });
    },
  });
}

export function useSquareoffPosition() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: ({ id, lots }: { id: string; lots?: number }) =>
      PositionsAPI.squareoff(id, lots),
    onMutate: ({ id, lots }) => {
      // Fire-and-forget cancels on all 3 caches we patch.
      void qc.cancelQueries({ queryKey: OPEN_KEY });
      void qc.cancelQueries({ queryKey: ACTIVE_KEY });
      void qc.cancelQueries({ queryKey: ["orders"] });
      const openSnap = qc.getQueryData<Position[]>(OPEN_KEY);
      const activeSnap = qc.getQueryData<ActiveTrade[]>(ACTIVE_KEY);

      // Capture the closing position BEFORE we mutate so we can match its
      // related active trades by token + product + direction.
      const closingPos = openSnap?.find((p) => p.id === id);

      // ── Market-closed pre-check ─────────────────────────────────
      // Without this, tapping CLOSE outside trading hours fired the
      // full optimistic-remove pipeline below (row disappears, orders
      // cache gets a placeholder), then the backend rejected with
      // MARKET_CLOSED and we rolled everything back. The user saw the
      // position card vanish for ~1 second and reappear — "trade
      // close ho jata hai 1 sec ke liye fir waapas aa jata hai".
      // Resolve segment/exchange off the cached position, abort the
      // mutation before any cache mutation happens, and surface a
      // single clear toast.
      if (
        closingPos &&
        !isInstrumentMarketOpen(closingPos.segment_type, closingPos.exchange)
      ) {
        const label = marketLabel(closingPos.segment_type, closingPos.exchange);
        pushToast({
          kind: "warn",
          message: `${label} market is closed — try closing during trading hours.`,
          ttlMs: 4000,
        });
        // Throwing from onMutate aborts the mutation entirely; the
        // onError handler below skips the rollback path because no
        // context was returned.
        throw new ApiError(`${label} market is closed`, "MARKET_CLOSED");
      }

      // ─── Open positions cache ───────────────────────────────────────
      qc.setQueryData<Position[]>(OPEN_KEY, (prev) => {
        if (!prev) return prev;
        if (lots == null) {
          return prev.filter((p) => p.id !== id);
        }
        return prev
          .map((p) => {
            if (p.id !== id) return p;
            const direction = Math.sign(p.quantity || 0) || 1;
            const signedReduction = lots * direction;
            const remaining = (p.quantity ?? 0) - signedReduction;
            if (Math.abs(remaining) < 1e-9) return null;
            // Same proportional-scaling fix as useCloseActiveTrade: the
            // old patch only updated `quantity`, so a partial-close
            // would leave `unrealized_pnl` / `lots` / `margin_used`
            // sitting at full-position values until the next REST poll.
            return scalePartialClose(p, remaining);
          })
          .filter((p): p is Position => p != null);
      });

      // ─── Active trades cache ────────────────────────────────────────
      // On a FULL close (no `lots` arg) drop every active trade row for
      // the same instrument + product + direction. On a partial close
      // leave them — FIFO matching individual fills is fragile to
      // replicate optimistically; the WS push reconciles in ~200 ms.
      if (lots == null && closingPos) {
        const dirSign = Math.sign(closingPos.quantity || 0);
        const targetAction: "BUY" | "SELL" = dirSign >= 0 ? "BUY" : "SELL";
        qc.setQueryData<ActiveTrade[]>(ACTIVE_KEY, (prev) =>
          prev
            ? prev.filter(
                (t) =>
                  !(
                    t.instrument_token === closingPos.instrument_token &&
                    t.product_type === closingPos.product_type &&
                    t.action === targetAction
                  ),
              )
            : prev,
        );
      }

      // ─── Orders cache ────────────────────────────────────────────────
      // Insert a synthetic close-order row so Orders → Open paints the
      // close request on the same frame as the tap.
      let prevOrders: Map<readonly unknown[], Order[] | undefined> | undefined;
      if (closingPos) {
        const closeLots = lots ?? Math.abs(closingPos.quantity || 0);
        const optOrder = makeOptimisticCloseOrder({
          symbol: closingPos.symbol,
          instrument_token: closingPos.instrument_token,
          product_type: closingPos.product_type,
          positionQty: closingPos.quantity,
          lotsHint: closeLots,
        });
        prevOrders = insertOptimisticOrder(qc, optOrder);
      }

      // ─── Wallet cache ───────────────────────────────────────────────
      // Release margin proportionally:
      //   • Full close (no `lots` arg) → return the whole position's
      //     margin_used + unrealized_pnl to available.
      //   • Partial close → release a proportional slice (lots / |qty|).
      let prevWallet: WalletSummaryShape | undefined;
      if (closingPos) {
        const absQty = Math.abs(closingPos.quantity || 0);
        const fraction =
          lots == null || absQty === 0 ? 1 : Math.min(1, lots / absQty);
        const fakePos: Position = {
          ...closingPos,
          margin_used: String(Number(closingPos.margin_used || 0) * fraction),
          unrealized_pnl: String(
            Number(closingPos.unrealized_pnl || 0) * fraction,
          ),
        };
        prevWallet = releaseMarginOptimistically(qc, [fakePos]);
      }

      // ─── Closed-tab cache ───────────────────────────────────────────
      // Only on a FULL close — partial closes leave the parent position
      // open so it shouldn't appear on the Closed tab. The user reported
      // "1-2 sec ke baad trade jaati hai Closed me" — this insertion
      // moves the row instantly in the same render frame as the tap.
      let prevClosed: Position[] | undefined;
      if (closingPos && lots == null) {
        prevClosed = insertOptimisticClosedPosition(qc, closingPos);
      }

      _openPositionsFreezeUntil = Date.now() + CLOSE_FREEZE_MS;
      _activeTradesFreezeUntil = Date.now() + CLOSE_FREEZE_MS;
      // Tone + haptic cue so the user knows the close press registered
      // before the network round-trip resolves. Same source-of-truth
      // for sounds as BUY/SELL — see shared/services/sounds.ts.
      sounds.close();
      pushToast({ kind: "success", message: "Position closed", ttlMs: 1500 });
      return { openSnap, activeSnap, prevOrders, prevWallet, prevClosed };
    },
    onSuccess: () => {
      // Defer-refetch Closed + PnL summary so the newly-closed position
      // shows up in the Closed tab once the matching engine writes it.
      scheduleClosedSync(qc);
    },
    onError: (e: ApiError, _vars, ctx) => {
      // Restore ALL caches we patched.
      if (ctx?.openSnap !== undefined) qc.setQueryData(OPEN_KEY, ctx.openSnap);
      if (ctx?.activeSnap !== undefined) qc.setQueryData(ACTIVE_KEY, ctx.activeSnap);
      if (ctx?.prevWallet !== undefined) {
        qc.setQueryData(WALLET_SUMMARY_KEY, ctx.prevWallet);
      }
      restoreClosedCache(qc, ctx?.prevClosed);
      rollbackOrders(qc, ctx?.prevOrders);
      _openPositionsFreezeUntil = 0;
      _activeTradesFreezeUntil = 0;
      pushToast({ kind: "error", message: e.message });
    },
  });
}

// SL/TP edit on a Position. Backend accepts `null` / `0` to clear a leg.
// Optimistically patches OPEN_KEY so the new values render instantly on
// the position card — even before the HTTP returns.
export function useUpdatePositionSlTp() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (vars: {
      id: string;
      stop_loss?: number | null;
      target?: number | null;
    }) =>
      PositionsAPI.updateSlTp(vars.id, {
        stop_loss: vars.stop_loss,
        target: vars.target,
      }),
    onMutate: ({ id, stop_loss, target }) => {
      const snap = qc.getQueryData<Position[]>(OPEN_KEY);
      qc.setQueryData<Position[]>(OPEN_KEY, (prev) =>
        prev
          ? prev.map((p) =>
              p.id === id
                ? {
                    ...p,
                    stop_loss:
                      stop_loss == null || stop_loss === 0
                        ? null
                        : String(stop_loss),
                    target:
                      target == null || target === 0 ? null : String(target),
                  }
                : p,
            )
          : prev,
      );
      pushToast({ kind: "success", message: "SL / TP updated", ttlMs: 1500 });
      return { snap };
    },
    onError: (e: ApiError, _vars, ctx) => {
      if (ctx?.snap !== undefined) qc.setQueryData(OPEN_KEY, ctx.snap);
      pushToast({ kind: "error", message: e.message });
    },
  });
}

// SL/TP edit on an ActiveTrade. Backend delegates to the parent position's
// SL/TP (FIFO/avg accounting — no per-fill stops), so the optimistic patch
// updates both ACTIVE_KEY (so the trade card paints the new values) and
// OPEN_KEY (so the Position card stays in sync).
export function useUpdateActiveTradeSlTp() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (vars: {
      tradeId: string;
      stop_loss?: number | null;
      target?: number | null;
    }) =>
      PositionsAPI.updateActiveTradeSlTp(vars.tradeId, {
        stop_loss: vars.stop_loss,
        target: vars.target,
      }),
    onMutate: ({ tradeId, stop_loss, target }) => {
      const activeSnap = qc.getQueryData<ActiveTrade[]>(ACTIVE_KEY);
      const openSnap = qc.getQueryData<Position[]>(OPEN_KEY);

      const sl =
        stop_loss == null || stop_loss === 0 ? null : String(stop_loss);
      const tp = target == null || target === 0 ? null : String(target);

      // Patch the trade row.
      const closingTrade = activeSnap?.find((t) => t.id === tradeId);
      qc.setQueryData<ActiveTrade[]>(ACTIVE_KEY, (prev) =>
        prev
          ? prev.map((t) =>
              t.id === tradeId ? { ...t, stop_loss: sl, target: tp } : t,
            )
          : prev,
      );

      // Also patch the parent position so Position tab agrees.
      if (closingTrade) {
        qc.setQueryData<Position[]>(OPEN_KEY, (prev) =>
          prev
            ? prev.map((p) =>
                p.instrument_token === closingTrade.instrument_token &&
                p.product_type === closingTrade.product_type
                  ? { ...p, stop_loss: sl, target: tp }
                  : p,
              )
            : prev,
        );
      }

      pushToast({ kind: "success", message: "SL / TP updated", ttlMs: 1500 });
      return { activeSnap, openSnap };
    },
    onError: (e: ApiError, _vars, ctx) => {
      if (ctx?.activeSnap !== undefined)
        qc.setQueryData(ACTIVE_KEY, ctx.activeSnap);
      if (ctx?.openSnap !== undefined) qc.setQueryData(OPEN_KEY, ctx.openSnap);
      pushToast({ kind: "error", message: e.message });
    },
  });
}
