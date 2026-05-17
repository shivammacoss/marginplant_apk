import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { OrdersAPI } from "@features/trade/api/orders.api";
import type { Order, PlaceOrderInput } from "@features/trade/types/order.types";
import type { ActiveTrade, Position } from "@features/portfolio/types/position.types";
import type { WalletSummary } from "@features/wallet/types/wallet.types";
import { ApiError } from "@core/api/errors";
import { useUiStore } from "@shared/store/ui.store";
import { useTickerStore } from "@features/trade/store/ticker.store";
import { freezePositionPollersForPlace } from "@features/portfolio/hooks/usePositions";

// Hints passed by call-sites (BuySellBar / TradeSheet) so the optimistic
// position row can show a proper symbol / exchange in the Portfolio tab
// before the real position lands. These fields are STRIPPED before the
// HTTP call so the backend never sees them.
interface PlaceOrderInputWithHints extends PlaceOrderInput {
  _displaySymbol?: string;
  _exchange?: string;
}

interface OptimisticCtx {
  tempOrderId: string;
  tempPositionId: string;
  tempTradeId: string;
  // Id of the green optimistic toast — if onError fires we dismiss it so
  // the user never sees a misleading green flash before the red rejection.
  optimisticToastId: string;
  prevOrderPages: Map<readonly unknown[], Order[] | undefined>;
  prevOpenPositions: Position[] | undefined;
  prevActiveTrades: ActiveTrade[] | undefined;
  prevWallet: WalletSummary | undefined;
}

const WALLET_SUMMARY_KEY = ["wallet", "summary"] as const;

// Approximate the margin that'll be blocked for a freshly-placed trade.
// We don't have the exact lot_size / leverage on the client in the same
// frame as the tap (effective-settings query may not have warmed yet), so
// we ballpark it. The exact number lands within ~200-500 ms via the
// `/ws/user` wallet event from the backend's wallet_service.block_margin,
// which replaces this optimistic patch. As long as the ballpark is in the
// right magnitude, the UX feels "instant" — that's the whole point.
//
// Math: notional × (1 / leverage). Default 5× leverage covers index F&O
// (5×), crypto (5-10×), MCX (3-5×) — high enough to under-charge MIS
// (typically 10-20% but the WS push will correct), low enough not to look
// like a free trade if the server actually blocks more.
function approxMarginFor(lots: number, ltp: number): number {
  if (!Number.isFinite(lots) || !Number.isFinite(ltp) || lots <= 0 || ltp <= 0) {
    return 0;
  }
  const notional = lots * ltp;
  return notional / 5;
}

function makeOptimisticOrder(body: PlaceOrderInput, tempId: string): Order {
  const now = new Date().toISOString();
  return {
    id: tempId,
    user_id: "",
    symbol: body.token,
    token: body.token,
    action: body.action,
    order_type: body.order_type,
    product_type: body.product_type,
    lots: body.lots,
    quantity: 0,
    filled_quantity: 0,
    pending_quantity: 0,
    price: String(body.price ?? "0"),
    trigger_price: String(body.trigger_price ?? "0"),
    average_price: "0",
    status: "PENDING",
    created_at: now,
  };
}

// Build a placeholder Position so the Portfolio tab shows the user's new
// trade the moment they tap BUY/SELL — no waiting on the backend's
// matching engine or the /ws/user "position" push. The real row replaces
// it within ~200-500 ms when the WS event lands (UserEventsProvider
// invalidates ["positions"] which triggers a refetch).
function makeOptimisticPosition(
  body: PlaceOrderInputWithHints,
  tempId: string,
): Position {
  // Pull last-known LTP from the ticker store so avg_price / ltp are
  // realistic — the user sees the right ballpark P&L immediately.
  const tick = useTickerStore.getState().ticks[body.token];
  const ltp = tick?.ltp ?? 0;
  const direction = body.action === "BUY" ? 1 : -1;
  // For Infoway / forex / metals the qty is `lots` directly (fractional
  // contracts). For Indian equity / index futures the real position will
  // arrive in < 1 s with the correct lot-size-multiplied qty, so this
  // placeholder doesn't have to be exact.
  const qty = body.lots * direction;
  const now = new Date().toISOString();

  return {
    id: tempId,
    user_id: "",
    symbol: body._displaySymbol ?? body.token,
    exchange: body._exchange,
    instrument_token: body.token,
    product_type: body.product_type,
    quantity: qty,
    lots: body.lots,
    avg_price: String(ltp),
    ltp: String(ltp),
    realized_pnl: "0",
    unrealized_pnl: "0",
    margin_used: "0",
    status: "OPEN",
    opened_at: now,
  };
}

// Per-fill ActiveTrade row — appears in the "Active" tab on Portfolio
// (which shows one row per BUY/SELL fill that's still open). Same shape
// as backend's /positions/active-trades response.
function makeOptimisticActiveTrade(
  body: PlaceOrderInputWithHints,
  tempId: string,
  positionId: string,
): ActiveTrade {
  const tick = useTickerStore.getState().ticks[body.token];
  const ltp = tick?.ltp ?? 0;
  const now = new Date().toISOString();
  return {
    id: tempId,
    trade_number: tempId,
    executed_at: now,
    position_id: positionId,
    symbol: body._displaySymbol ?? body.token,
    exchange: body._exchange,
    instrument_token: body.token,
    action: body.action,
    side: body.action,
    product_type: body.product_type,
    quantity: body.lots,
    lots: body.lots,
    lot_size: 1,
    price: String(ltp),
    ltp: String(ltp),
    pnl: "0",
  };
}

const OPEN_POSITIONS_KEY = ["positions", "open"] as const;
const ACTIVE_TRADES_KEY = ["positions", "active-trades"] as const;

/**
 * Order placement with optimistic UI:
 *   - onMutate inserts a PENDING order row into every cached orders query AND
 *     a synthetic OPEN position into the positions cache, so both the Orders
 *     tab and the Portfolio tab paint the trade IMMEDIATELY — no waiting on
 *     the backend's matching engine or the /ws/user push.
 *   - onError rolls both caches back to their pre-mutation snapshots.
 *   - /ws/user events (UserEventsProvider) invalidate ["positions"] /
 *     ["orders"] as soon as the backend confirms; React Query refetches and
 *     the real rows replace the optimistic ones within ~200 ms.
 */
export function usePlaceOrder() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  const dismissToast = useUiStore((s) => s.dismissToast);

  return useMutation<Order, ApiError, PlaceOrderInputWithHints, OptimisticCtx>({
    mutationFn: (body) => {
      // Strip the UI-only hint fields before hitting the backend.
      const { _displaySymbol: _s, _exchange: _e, ...payload } = body;
      void _s;
      void _e;
      return OrdersAPI.place(payload as PlaceOrderInput);
    },

    onMutate: async (body) => {
      // Pause the positions + active-trades pollers for ~2.5 s so the
      // optimistic row we're about to insert isn't immediately overwritten
      // by a refetch that fires while the backend's matching engine is
      // still committing the trade. This was the "trade dikhi, 1 sec ke
      // liye gayab ho gayi, fir vapas aayi" symptom — the next poll
      // landed before the server committed, returned the old list, and
      // the optimistic row got replaced until the post-commit poll.
      freezePositionPollersForPlace();

      const tempOrderId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const tempPositionId = `tmp-pos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const tempTradeId = `tmp-trade-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optOrder = makeOptimisticOrder(body, tempOrderId);
      const optPos = makeOptimisticPosition(body, tempPositionId);
      const optTrade = makeOptimisticActiveTrade(body, tempTradeId, tempPositionId);

      // ─── Optimistic ORDER row across every cached orders page ───────
      const allOrderPages = qc.getQueriesData<Order[]>({ queryKey: ["orders"] });
      const prevOrderPages = new Map<readonly unknown[], Order[] | undefined>();
      for (const [key, value] of allOrderPages) {
        prevOrderPages.set(key, value);
        if (Array.isArray(value)) {
          qc.setQueryData<Order[]>(key, [optOrder, ...value]);
        }
      }

      // ─── Optimistic POSITION row in the open-positions cache ────────
      // Cancel any in-flight fetch so it can't overwrite our optimistic
      // insertion while the backend is still processing the order.
      await qc.cancelQueries({ queryKey: OPEN_POSITIONS_KEY });
      const prevOpenPositions = qc.getQueryData<Position[]>(OPEN_POSITIONS_KEY);
      qc.setQueryData<Position[]>(OPEN_POSITIONS_KEY, (prev) => {
        const existing = prev ?? [];
        // If a position for the same token + product + direction already
        // exists, top up its lots instead of inserting a duplicate row.
        const dirSign = body.action === "BUY" ? 1 : -1;
        const matchIdx = existing.findIndex(
          (p) =>
            p.instrument_token === body.token &&
            p.product_type === body.product_type &&
            Math.sign(p.quantity || 0) === dirSign,
        );
        if (matchIdx >= 0) {
          const next = existing.slice();
          const cur = existing[matchIdx]!;
          // Compute the CONTRACT increment correctly: for Indian
          // equity / index F&O / MCX, one lot adds lot_size contracts
          // (e.g. GOLD lot_size=100 → 1 lot adds 100 to quantity).
          // Previously we added `body.lots` directly to quantity, so
          // a 1-lot GOLD top-up moved quantity from 300 → 301 instead
          // of 300 → 400 — that's the "lot/qty bahut slow update ho
          // raha hai" symptom (qty looked frozen until WS refetched).
          // Lot size is taken from the existing position's stored
          // lot_size; falls back to 1 (correct for forex/crypto where
          // lots ARE the contract count).
          const curLotSize = Number(cur.lot_size ?? 0) || 1;
          const contractIncrement = body.lots * curLotSize * dirSign;
          const nextQuantity = (cur.quantity ?? 0) + contractIncrement;
          const nextLotsRaw = (Number(cur.lots) || 0) + body.lots;
          // Scale unrealized_pnl UP to match the new quantity. Without
          // this, after a top-up the row showed (say) 3 lots' qty but
          // still the 2 lots' P&L until the next REST poll landed.
          const prevAbs = Math.abs(cur.quantity ?? 0);
          const nextAbs = Math.abs(nextQuantity);
          const scale = prevAbs > 0 ? nextAbs / prevAbs : 1;
          const scaleStr = (v: unknown): string | undefined => {
            if (v == null) return undefined;
            const n = Number(v);
            if (!Number.isFinite(n)) return undefined;
            return String(n * scale);
          };
          const scaledUnrealized = scaleStr(cur.unrealized_pnl);
          const scaledMargin = scaleStr(cur.margin_used);
          next[matchIdx] = {
            ...cur,
            quantity: nextQuantity,
            lots: nextLotsRaw,
            ...(scaledUnrealized !== undefined
              ? { unrealized_pnl: scaledUnrealized }
              : {}),
            ...(scaledMargin !== undefined
              ? { margin_used: scaledMargin }
              : {}),
          };
          return next;
        }
        return [optPos, ...existing];
      });

      // ─── Optimistic ACTIVE TRADE row in the per-fill cache ──────────
      // Active trades are per-fill — every BUY/SELL gets its own row
      // (unlike positions which aggregate). So we ALWAYS push a new row
      // here, no merging. Backend WS push replaces it within ~200 ms.
      await qc.cancelQueries({ queryKey: ACTIVE_TRADES_KEY });
      const prevActiveTrades = qc.getQueryData<ActiveTrade[]>(ACTIVE_TRADES_KEY);
      qc.setQueryData<ActiveTrade[]>(ACTIVE_TRADES_KEY, (prev) => [
        optTrade,
        ...(prev ?? []),
      ]);

      // ─── Optimistic WALLET patch ────────────────────────────────────
      // The user wants "Margin Used" to react on the same frame as the
      // tap, not after the wallet/summary poll lands (10 s) or the WS
      // event arrives (200-500 ms). Move approxMargin from
      // available_balance → used_margin so the KPI strip on Portfolio
      // moves visibly the moment the order fires. The /ws/user `wallet`
      // event replaces this with the exact server-computed margin a few
      // hundred ms later.
      const tick = useTickerStore.getState().ticks[body.token];
      const approxMargin = approxMarginFor(
        body.lots,
        tick?.ltp ?? Number(body.price ?? 0),
      );
      const prevWallet = qc.getQueryData<WalletSummary>(WALLET_SUMMARY_KEY);
      if (prevWallet && approxMargin > 0) {
        const nextAvail = Math.max(
          0,
          Number(prevWallet.available_balance ?? 0) - approxMargin,
        );
        const nextUsed = Number(prevWallet.used_margin ?? 0) + approxMargin;
        qc.setQueryData<WalletSummary>(WALLET_SUMMARY_KEY, {
          ...prevWallet,
          available_balance: String(nextAvail),
          used_margin: String(nextUsed),
        });
      }

      // INSTANT green toast on tap — the user explicitly wants zero
      // perceived latency between press and confirmation. To avoid the
      // earlier "GREEN→RED flash on failure" bug, we capture the toast id
      // and `dismissToast` it in onError BEFORE pushing the red one, so a
      // rejected trade only ever shows the error message.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const optimisticToastId = pushToast({
        kind: "success",
        message: `${body.action} ${body.lots} placed`,
        ttlMs: 1800,
      });

      return {
        tempOrderId,
        tempPositionId,
        tempTradeId,
        optimisticToastId,
        prevOrderPages,
        prevOpenPositions,
        prevActiveTrades,
        prevWallet,
      };
    },

    onSuccess: (order, _body, ctx) => {
      // Optimistic green toast already on screen — nothing more to show.
      //
      // Nudge the Portfolio cards so they reconcile immediately instead of
      // waiting for their refetchInterval poll. Targeted invalidations
      // only — the previous "invalidate everything" approach made the
      // Market screen flicker on every trade. These two are scoped:
      //   • pnl-summary  → Total P&L card on Portfolio
      //   • wallet/summary → Ledger / Margin Available / Margin Used KPIs
      // The WS push from wallet_service.block_margin handles the wallet
      // refresh too, but invalidating here covers users whose WS is mid-
      // reconnect.
      void qc.invalidateQueries({ queryKey: ["positions", "pnl-summary"] });
      void qc.invalidateQueries({ queryKey: ["wallet", "summary"] });

      // Replace the optimistic order row with the real one in every
      // cached page.
      //
      // We DON'T invalidate ["orders"] / ["positions"] / ["wallet"] from
      // here — those cascading refetches caused the Market screen to
      // flicker on every trade. The /ws/user push (UserEventsProvider)
      // handles the real-time sync. If WS is down, the regular
      // refetchInterval reconciles within 3 s.
      if (ctx) {
        const all = qc.getQueriesData<Order[]>({ queryKey: ["orders"] });
        for (const [key, value] of all) {
          if (!Array.isArray(value)) continue;
          qc.setQueryData<Order[]>(
            key,
            value.map((o) => (o.id === ctx.tempOrderId ? order : o)),
          );
        }
      }
    },

    onError: (e, _body, ctx) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Pull the optimistic green toast off-screen BEFORE pushing the red
      // one, otherwise the user sees both stacked which makes a rejected
      // order look "partially placed". Dismiss-then-push is the same
      // pattern react-hot-toast uses for promise() toasts.
      if (ctx?.optimisticToastId) dismissToast(ctx.optimisticToastId);
      // Map common business-logic codes to a clear English sentence so the
      // user knows WHY their trade was rejected. The default
      // `normaliseMessage` in core/api/errors.ts turns 502/503/504 into
      // "Server unreachable" — which is misleading when the actual cause is
      // an insufficient-wallet 400 from order_validator. We override here.
      pushToast({ kind: "error", message: orderErrorMessage(e) });
      // Rollback ALL four caches we patched.
      if (ctx) {
        ctx.prevOrderPages.forEach((value, key) => {
          qc.setQueryData(key, value);
        });
        qc.setQueryData(OPEN_POSITIONS_KEY, ctx.prevOpenPositions);
        qc.setQueryData(ACTIVE_TRADES_KEY, ctx.prevActiveTrades);
        if (ctx.prevWallet !== undefined) {
          qc.setQueryData(WALLET_SUMMARY_KEY, ctx.prevWallet);
        }
      }
    },
  });
}

// Translate the backend's order-placement error codes into a single-line
// English message the user can act on. Order of priority: code (most
// reliable, set by the AppError subclass) → status (HTTP) → message
// (last-resort raw string from the server).
function orderErrorMessage(e: ApiError): string {
  switch (e.code) {
    case "INSUFFICIENT_FUNDS":
      return "Insufficient balance — add funds to place this trade.";
    // ── Admin Risk Management codes — emitted by the backend's
    //    order_validator when global / per-user risk rules fire. Mapping
    //    them explicitly here lets the user see WHY their order was
    //    rejected (instead of a generic "Order rejected" toast).
    case "EXIT_ONLY_MODE":
      return "Exit-only mode is on — only closing trades are allowed right now.";
    case "LOT_PER_ORDER_MAX":
      return e.message || "Lots exceed the admin's per-order maximum.";
    case "SEGMENT_NOT_ALLOWED":
      return e.message || "Trading is paused for this segment — only closing trades are allowed.";
    case "HOLD_TIME_GUARD":
      return e.message || "Hold-time guard active — wait before closing this trade.";
    case "ORDER_REJECTED":
      // OrderRejectedError without a more-specific code — surface the
      // backend's prose verbatim (it carries the actual reason).
      return e.message || "Order rejected by risk checks.";
    case "VALIDATION_FAILED":
      return e.message || "Invalid order — check lots / price and try again.";
    case "MARKET_CLOSED":
      return "Market is closed for this instrument.";
    case "RATE_LIMIT_EXCEEDED":
      return "Too many orders — slow down and retry.";
  }
  // Fall back to whatever the error normaliser produced, except in the one
  // case where we know that message is wrong: 502/503/504 here usually
  // means an upstream rejection, not a literal "unreachable" server.
  if (e.status === 502 || e.status === 503 || e.status === 504) {
    return "Order could not be placed — please try again in a moment.";
  }
  return e.message ?? "Order failed";
}
