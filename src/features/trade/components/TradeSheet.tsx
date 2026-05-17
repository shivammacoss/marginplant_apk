import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { useTicker } from "@features/trade/hooks/useTicker";
import { useQuote } from "@features/trade/hooks/useQuote";
import { usePlaceOrder } from "@features/trade/hooks/usePlaceOrder";
import { sounds } from "@shared/services/sounds";
import {
  pickDefaultLot,
  pickMinLot,
  useEffectiveSettings,
} from "@features/trade/hooks/useEffectiveSettings";
import { useInstrumentLabel } from "@features/trade/hooks/useInstrument";
import { lookupInfowayLot } from "@features/trade/utils/infowayLots";
import { isInstrumentMarketOpen, marketLabel } from "@shared/utils/marketHours";
import { useWalletSummary } from "@features/wallet/hooks/useWallet";
import { usePnLSummary } from "@features/portfolio/hooks/usePositions";
import { useUiStore } from "@shared/store/ui.store";
import { formatINR, formatNumber } from "@shared/utils/format";
import type { OrderAction } from "@features/trade/types/order.types";

const BUY_GREEN = "#22C55E";
const SELL_RED = "#EF4444";
const ACCENT_PURPLE = "#5E35F2";

export interface TradeSheetRef {
  open: (args: { token: string; symbol?: string; name?: string }) => void;
  close: () => void;
}

interface State {
  token: string;
  symbol?: string;
  name?: string;
}

type Mode = "market" | "limit";
type SideTab = "BUY" | "SELL";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Full INR formatter for the 6-KPI grid — renders the actual rupee
// amount with Indian lakh/crore grouping (2,12,345.67) instead of
// abbreviating to "K" / "L" / "Cr". The previous compact variant was
// removed per user feedback: traders prefer seeing the exact figure
// on the wallet strip, not a rounded summary that hid the last digits.
const _inrFull = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function compactINR(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `₹${_inrFull.format(v)}`;
}

function Backdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.55}
    />
  );
}

interface TradeSheetProps {
  // Set when the provider lazy-mounts us in response to an `open()` call.
  // The mount effect below picks this up and auto-opens the sheet on the
  // first frame so the caller never has to do `open()` after `setMounted`.
  initialArgs?: { token: string; symbol?: string; name?: string } | null;
  // Fired AFTER Gorhom's close animation completes — provider uses this
  // to unmount the entire sheet so non-trade screens stay sheet-free.
  onClosed?: () => void;
}

export const TradeSheet = forwardRef<TradeSheetRef, TradeSheetProps>(({ initialArgs, onClosed }, ref) => {
  const sheet = useRef<BottomSheet>(null);
  const lastFireAt = useRef(0);
  // Seed `target` from initialArgs on the very first render so the sheet
  // mounts with content + valid interactive props (handle, pan gestures).
  // Doing this via a useEffect produced a one-frame window where Gorhom
  // measured an empty sheet and snapped to a tiny height near the navbar
  // — that was the "click karta hu lekin pura open nahi hota" bug.
  const [target, setTarget] = useState<State | null>(initialArgs ?? null);
  const [side, setSide] = useState<SideTab>("BUY");
  const [mode, setMode] = useState<Mode>("market");
  // Seeded with "" so the first paint doesn't flash "0.01" before the
  // admin-resolved default lot arrives. The effect below replaces it with
  // `order_lot ?? min_lot ?? 1` from /user/segment-settings/effective the
  // moment the response lands (typically <100 ms on cache hit).
  const [lots, setLots] = useState("");
  // ── LOT ⇄ QTY input mode ─────────────────────────────────────────
  // Tapping the "Qty" pill (top-right of the lot strip) flips the
  // stepper between LOT and contract-quantity display. The canonical
  // state stays `lots` — QTY mode is purely a presentation layer:
  // editing the qty input divides by `lot_size` to update `lots`,
  // bumping the stepper changes qty by exactly one lot_size, and the
  // label below the input swaps "LOT" ↔ "QTY". The pill itself shows
  // the OTHER unit (the one a tap would switch INTO) so the affordance
  // reads naturally — "Qty" while in LOT mode, "Lot" while in QTY mode.
  const [inputMode, setInputMode] = useState<"LOT" | "QTY">("LOT");
  const [slTpEnabled, setSlTpEnabled] = useState(false);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  // Limit-order price the user types. Empty string until they tap the
  // "Limit" segmented button — that handler seeds it with the current
  // bid/ask so they don't have to start from blank. Strings stay strings
  // so the input doesn't re-render on every parent re-render.
  const [limitPrice, setLimitPrice] = useState("");

  useImperativeHandle(ref, () => ({
    open: (args) => {
      setTarget(args);
      // Lots reset to "" — the admin-default-lot effect re-seeds it as
      // soon as /user/segment-settings/effective returns for this token.
      // The seeded-token ref is cleared so the seed runs again even if
      // the same token is re-opened after a manual edit.
      seededTokenRef.current = null;
      setLots("");
      setMode("market");
      setSide("BUY");
      setSlTpEnabled(false);
      setStopLoss("");
      setTakeProfit("");
      setLimitPrice("");
      // Reset to LOT mode on every new instrument so the user always
      // sees the "lots" view first — that's the primary unit.
      setInputMode("LOT");
      // Defer the snap call by one frame so React commits the `target`
      // state and the inner BottomSheet finishes its measurement pass
      // BEFORE we ask it to expand. Without this delay the FIRST open
      // (especially on cold mount) lands at a tiny height stuck near the
      // navbar — Gorhom measures the empty (target=null) content and
      // uses that as its base. Combined with `enableDynamicSizing={false}`
      // on the sheet, this guarantees the sheet always animates to 90%.
      requestAnimationFrame(() => {
        sheet.current?.snapToIndex(0);
      });
    },
    close: () => sheet.current?.close(),
  }));

  // The sheet starts at index=0 when initialArgs are provided (see the
  // <BottomSheet index={...}> below), so no snapToIndex effect is needed
  // on mount — Gorhom opens it itself with the right content already in
  // place. This eliminates the race that produced the half-height sheet.

  const snapPoints = useMemo(() => ["90%"], []);

  const tick = useTicker(target?.token ?? null);
  const quote = useQuote(target?.token ?? null);
  const label = useInstrumentLabel(target?.token ?? null);
  const wallet = useWalletSummary();
  const pnl = usePnLSummary();
  // Admin-resolved segment settings — drives the default + min lot the
  // input shows. Re-fetches whenever the user opens a different
  // instrument or flips BUY/SELL (different admin overrides may apply per
  // side). Cached 30 s so flipping side back is instant.
  const effective = useEffectiveSettings(target?.token ?? null, side, "MIS");
  const adminDefaultLot = pickDefaultLot(effective.data);
  const adminMinLot = pickMinLot(effective.data);

  // Track which token we've already seeded the admin default for. Without
  // this guard the effect below would clobber the user's manual edits
  // every time settings refresh in the background.
  const seededTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!target?.token) {
      seededTokenRef.current = null;
      return;
    }
    if (seededTokenRef.current === target.token) return;
    if (effective.data) {
      setLots(adminDefaultLot);
      seededTokenRef.current = target.token;
    }
  }, [target?.token, effective.data, adminDefaultLot]);

  // Prefer live WS tick → falls back to REST quote → "—". OHLC fields
  // come straight off the WS payload (see marketdata.service.toTick) so
  // they update tick-by-tick instead of waiting on the slow /quote REST
  // poll. Falls back to /quote when the WS hasn't pushed yet (cold start
  // / Infoway feed mid-reconnect / instrument that doesn't stream OHLC).
  const ltp = tick?.ltp ?? quote.data?.ltp ?? null;
  const bid = tick?.bid ?? quote.data?.bid ?? ltp ?? null;
  const ask = tick?.ask ?? quote.data?.ask ?? ltp ?? null;
  const change = tick?.change ?? quote.data?.change ?? 0;
  const changePct = tick?.change_pct ?? quote.data?.change_pct ?? 0;
  const open = tick?.open ?? quote.data?.open ?? 0;
  const high = tick?.high ?? quote.data?.high ?? 0;
  const low = tick?.low ?? quote.data?.low ?? 0;

  const place = usePlaceOrder();
  const pushToast = useUiStore((s) => s.pushToast);

  const symbol = target?.symbol ?? label.symbol;

  // Wallet-derived KPIs — match the web math (ledger = avail + used,
  // equity = ledger + open_unrealised).
  const avail = Number(wallet.data?.available_balance ?? 0);
  const used = Number(wallet.data?.used_margin ?? 0);
  const m2m = Number(pnl.data?.open_unrealised ?? wallet.data?.unrealized_pnl ?? 0);
  const totalBalance = avail + used;
  const equity = totalBalance + m2m;
  // Today's session P&L for the INTRADAY KPI tile. Prefers `today_pnl`
  // (realised + unrealised for today) from /positions/pnl-summary, falls
  // back to `today_realised` if only that's populated, then 0. Backend
  // computes this server-side over `executed_at >= midnight IST` so it's
  // already the "today's session" number — no client-side filtering needed.
  const intradayPnl =
    Number(pnl.data?.today_pnl ?? pnl.data?.today_realised ?? 0) || 0;

  const lastTradeTime = useMemo(() => {
    const ts = tick?.ts ?? Date.now();
    return new Date(ts).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, [tick?.ts]);

  function bumpLots(direction: 1 | -1) {
    // Step matches the magnitude of the admin-set minimum lot so the
    // − / + buttons feel natural per-segment: 0.01 step for fractional
    // commodity contracts (GOLD 0.01 lot), 1 step for whole-lot
    // contracts (NIFTY 1 lot). Floor is the admin's min_lot.
    const current = num(lots) || adminMinLot;
    const step = adminMinLot >= 1 ? 1 : adminMinLot || 0.01;
    const next = Math.max(adminMinLot, +(current + direction * step).toFixed(3));
    setLots(String(next));
    void Haptics.selectionAsync();
  }

  // Resolved lot_size for this instrument. Three sources, first non-1
  // wins:
  //   1. Backend's `/segment-settings/effective` — authoritative when
  //      the backend has been restarted with the infoway-lot heal.
  //   2. APK-side `lookupInfowayLot` — defensive fallback so crypto /
  //      forex / metals / energy convert correctly even if the backend
  //      still returns the stale `instrument.lot_size = 1` (legacy
  //      auto-created rows).
  //   3. `1` — neutral default; toggle becomes a visual no-op for
  //      symbols where 1 lot really does equal 1 contract.
  const backendLotSize = Number(effective.data?.lot_size ?? 0);
  const fallbackLotSize =
    lookupInfowayLot(target?.symbol ?? null) ?? lookupInfowayLot(target?.token ?? null);
  const lotSizeForConv =
    backendLotSize > 1
      ? backendLotSize
      : fallbackLotSize && fallbackLotSize > 1
      ? fallbackLotSize
      : backendLotSize > 0
      ? backendLotSize
      : 1;

  // Derived display value for the stepper input — `lots` is the
  // canonical state; QTY mode renders `lots × lot_size`.
  const stepperDisplayValue =
    inputMode === "QTY"
      ? (() => {
          const n = num(lots);
          if (!n) return "";
          const q = n * lotSizeForConv;
          // Strip trailing zeros so a 1-lot × 100-lot-size renders "100"
          // instead of "100.000".
          return Number.isInteger(q) ? String(q) : String(+q.toFixed(3));
        })()
      : lots;

  function onStepperChangeText(raw: string) {
    const clean = raw.replace(/[^\d.]/g, "");
    if (inputMode === "LOT") {
      setLots(clean);
      return;
    }
    // QTY mode — divide the typed quantity by lot_size to derive lots.
    // An empty input clears `lots`; otherwise we round to 3 decimals
    // (same precision the bump path uses) so the saved value is stable.
    if (clean === "" || clean === ".") {
      setLots("");
      return;
    }
    const qty = Number(clean);
    if (!Number.isFinite(qty)) return;
    const next = +(qty / lotSizeForConv).toFixed(3);
    setLots(String(next));
  }

  function openChart() {
    if (!target) return;
    // Push first, close second — same race fix as `openOptionChain`.
    // The previous "close → 120ms setTimeout → push" order sometimes
    // dropped the push entirely when Gorhom's close animation was still
    // running, leaving the user stuck on the sheet with nothing
    // happening.
    router.push({ pathname: "/(tabs)/trade", params: { token: target.token } });
    sheet.current?.close();
  }

  // Underlying name for the option-chain pill. Three flavours to handle:
  //   1. Spot stock / index (RELIANCE, NIFTY, BANKNIFTY) — `target.symbol`
  //      already IS the underlying the option-chain endpoint expects.
  //   2. Option / future contract (NIFTY26519238PE, GOLD26DECFUT) — the
  //      trading symbol carries date + strike + CE/PE/FUT noise; the
  //      bare underlying lives in `label.name` (set by the backend's
  //      `instrument_service.display_name` helper).
  //   3. Infoway-fed crypto / forex (BTCUSD, EURUSD) — no option chain
  //      exists; we still navigate so the chain screen shows its own
  //      "No options available for X" empty state rather than swallowing
  //      the tap silently (the user reported "click karta hu kuch nahi
  //      hota" — silent fails are worse than a clear empty page).
  function openOptionChain() {
    if (!target) return;
    const tradingSym = (symbol || target.token).toUpperCase();
    // Detect derivative-style symbols: contain a digit AND end in
    // CE/PE/FUT/EXP. Stocks (RELIANCE, TCS) have no digits in the symbol.
    const looksDerivative =
      /\d/.test(tradingSym) && /(CE|PE|FUT|EXP)$/.test(tradingSym);
    const underlying = looksDerivative
      ? (label.name || tradingSym).toUpperCase()
      : tradingSym;
    // Navigate FIRST, close sheet on the same frame. The earlier 120 ms
    // setTimeout-before-push was the "option chain me click karta hu kuch
    // open hi nahi hota" bug — Gorhom's close animation was racing the
    // navigation push and sometimes ate it. Pushing first guarantees the
    // route enters the stack regardless of what the sheet does next.
    router.push(`/option-chain/${encodeURIComponent(underlying)}`);
    sheet.current?.close();
  }

  function fire(action: OrderAction) {
    if (!target) return;
    // Throttle FIRST so a double-tap doesn't fire two orders or stack two
    // haptics/voice cues. 350 ms is well under any human's "two distinct
    // taps" threshold but above an accidental long-press double-event.
    const now = Date.now();
    if (now - lastFireAt.current < 350) return;
    lastFireAt.current = now;

    // No haptic here — usePlaceOrder.onMutate fires the notification-style
    // haptic + toast in the same microtask as place.mutate(), so the user
    // gets one instant ping (not two stacked vibrations).

    const value = num(lots);
    if (value <= 0) {
      pushToast({ kind: "warn", message: "Enter lots greater than 0" });
      return;
    }
    // ── Admin per-order lot cap pre-check ─────────────────────────
    // Backend rejects with code `LOT_PER_ORDER_MAX` when `lots`
    // exceeds the admin's `order_lot` cap. Without this client-side
    // mirror, the optimistic flow (haptic + green toast + cached
    // position insert) fired before the backend rejection landed —
    // the user reported "10 lots typed, 5 lots ho gaya" because they
    // didn't see the rejection clearly enough. We surface it BEFORE
    // place.mutate so there's no flicker, no audio cue, no green
    // toast — just one clear red warning.
    const adminMaxLot = Number(effective.data?.order_lot ?? 0);
    if (adminMaxLot > 0 && value > adminMaxLot) {
      pushToast({
        kind: "warn",
        message: `Maximum ${adminMaxLot} lot(s) per order`,
      });
      return;
    }
    if (adminMinLot > 0 && value < adminMinLot) {
      pushToast({
        kind: "warn",
        message: `Minimum ${adminMinLot} lot(s) required`,
      });
      return;
    }
    // ── Market-closed pre-check ────────────────────────────────
    // Without this the user sees a green "BUY 1 placed" toast
    // for 500-1000 ms before the backend's MarketClosedError lands
    // and rolls everything back. Same pattern the close-side
    // hooks use — gate BEFORE place.mutate so there's no flicker.
    // Segment comes from the resolved admin settings (canonical),
    // exchange from the instrument label fallback.
    const segForHours = effective.data?.segment_type;
    const exchForHours = (label as { exchange?: string } | null)?.exchange;
    if (!isInstrumentMarketOpen(segForHours, exchForHours)) {
      const closedLabel = marketLabel(segForHours, exchForHours);
      pushToast({
        kind: "warn",
        message: `${closedLabel} market is closed. Try placing an AMO instead.`,
        ttlMs: 4000,
      });
      return;
    }
    // LIMIT order — parse + validate the user-entered price. Backend's
    // pending_order_poller fires the order when LTP crosses this price.
    // BUY-side limit must be ≤ ask (else it'd fill instantly as a market
    // taker); SELL-side must be ≥ bid. We warn instead of blocking
    // outright since the user might want to "lock in better than market"
    // (e.g. BUY-limit above ask = guaranteed immediate fill at the limit
    // price ceiling, which is a legitimate strategy).
    let limitPriceNum: number | null = null;
    if (mode === "limit") {
      const lp = limitPrice.trim() ? Number(limitPrice) : NaN;
      if (!Number.isFinite(lp) || lp <= 0) {
        pushToast({
          kind: "warn",
          message: "Enter a valid limit price",
        });
        return;
      }
      limitPriceNum = lp;
    }
    // Parse SL/TP if the user enabled the toggle and entered values.
    // Empty / invalid → null (backend treats null as "no bracket leg").
    // Sanity-check direction: BUY → SL below entry, TP above. SELL → flipped.
    let slPrice: number | null = null;
    let tpPrice: number | null = null;
    if (slTpEnabled) {
      const sideQuote = action === "BUY" ? ask : bid;
      const sl = stopLoss.trim() ? Number(stopLoss) : NaN;
      const tp = takeProfit.trim() ? Number(takeProfit) : NaN;
      if (Number.isFinite(sl) && sl > 0) {
        if (sideQuote != null) {
          const valid = action === "BUY" ? sl < sideQuote : sl > sideQuote;
          if (!valid) {
            pushToast({
              kind: "warn",
              message:
                action === "BUY"
                  ? `Stop loss must be below ${formatNumber(sideQuote, 2)}`
                  : `Stop loss must be above ${formatNumber(sideQuote, 2)}`,
            });
            return;
          }
        }
        slPrice = sl;
      }
      if (Number.isFinite(tp) && tp > 0) {
        if (sideQuote != null) {
          const valid = action === "BUY" ? tp > sideQuote : tp < sideQuote;
          if (!valid) {
            pushToast({
              kind: "warn",
              message:
                action === "BUY"
                  ? `Target must be above ${formatNumber(sideQuote, 2)}`
                  : `Target must be below ${formatNumber(sideQuote, 2)}`,
            });
            return;
          }
        }
        tpPrice = tp;
      }
    }

    // Tone + haptic — same source-of-truth as the chart BUY/SELL bar
    // so press feedback feels consistent across every entry point.
    if (action === "BUY") sounds.buy();
    else sounds.sell();
    sheet.current?.close();
    place.mutate({
      token: target.token,
      action,
      order_type: mode === "market" ? "MARKET" : "LIMIT",
      product_type: "MIS",
      lots: value,
      // LIMIT → user-entered price (validated above). MARKET → undefined
      // (backend fills at expected_price below, which is the live quote
      // the user saw on screen so the fill never tick-slips).
      price: mode === "limit" ? limitPriceNum ?? undefined : undefined,
      stop_loss: slPrice,
      target: tpPrice,
      // Backend's matching engine uses this to fill MARKET orders at the
      // exact bid/ask the user saw — eliminates tick-slip on volatile
      // instruments. Mirrors the web's TradeDetailSheet.
      expected_price: mode === "market" ? (action === "BUY" ? ask : bid) : null,
      // UI-only hint — usePlaceOrder uses this to label the optimistic
      // position row on the Portfolio tab so the user sees the right
      // symbol immediately, before the WS push replaces the row.
      _displaySymbol: symbol ?? target.symbol,
    });
  }

  // Gorhom keeps the handle / pan area listening to gestures even at
  // index=-1, so an upward swipe from the bottom of ANY screen was
  // dragging the empty sheet open (the "niche se kuch open ho ke pura
  // app patch ho jata hai" bug). When no target is set we hard-disable
  // every pan + handle gesture so the sheet can ONLY open via the
  // imperative `open()` call from a Buy/Sell tap.
  const interactive = target != null;

  // Mount in the OPEN state when the provider gave us initialArgs, otherwise
  // stay fully closed (-1). Combined with the lazy-mount in TradeSheetProvider
  // this means the sheet is born fully expanded on the first frame the user
  // taps a stock — no race between mount, layout, and `snapToIndex`.
  const initialIndex = initialArgs?.token ? 0 : -1;

  return (
    <BottomSheet
      ref={sheet}
      index={initialIndex}
      snapPoints={snapPoints}
      // FALSE forces the sheet to honour `snapPoints` instead of measuring
      // content height (which, on first open, was empty → tiny sheet near
      // navbar — the user's reported bug).
      enableDynamicSizing={false}
      enablePanDownToClose={interactive}
      enableHandlePanningGesture={interactive}
      enableContentPanningGesture={interactive}
      enableOverDrag={false}
      handleComponent={interactive ? undefined : null}
      backdropComponent={Backdrop}
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.textDim }}
      onClose={() => {
        setTarget(null);
        onClosed?.();
      }}
    >
      <BottomSheetView style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}>
        {target ? (
          <>
            {/* Header row: symbol + "1" pill | bid red / ask green | X */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 20, fontWeight: "800", marginRight: 6 }}>
                {symbol}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                  backgroundColor: colors.bgElevated,
                }}
              >
                <Ionicons name="cart" size={11} color={colors.textMuted} />
                <Text size="xs" tone="muted" style={{ marginLeft: 3, fontWeight: "700" }}>
                  1
                </Text>
              </View>
              <View style={{ flex: 1 }} />
              <View style={{ alignItems: "flex-end" }}>
                <View style={{ flexDirection: "row" }}>
                  <Text
                    mono
                    style={{
                      color: SELL_RED,
                      fontSize: 15,
                      fontWeight: "800",
                      marginRight: 10,
                    }}
                  >
                    {bid != null ? formatNumber(bid, 2) : "—"}
                  </Text>
                  <Text
                    mono
                    style={{ color: BUY_GREEN, fontSize: 15, fontWeight: "800" }}
                  >
                    {ask != null ? formatNumber(ask, 2) : "—"}
                  </Text>
                </View>
                <Text
                  mono
                  size="xs"
                  style={{
                    color: change >= 0 ? BUY_GREEN : SELL_RED,
                    fontWeight: "700",
                    marginTop: 2,
                  }}
                >
                  {change >= 0 ? "+" : ""}
                  {formatNumber(change, 2)} ({changePct >= 0 ? "+" : ""}
                  {formatNumber(changePct, 2)}%)
                </Text>
              </View>
              <Pressable
                onPress={() => sheet.current?.close()}
                hitSlop={10}
                style={{ marginLeft: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text tone="muted" size="xs" style={{ marginTop: 4 }}>
              LTP {ltp != null ? formatNumber(ltp, 2) : "—"}
            </Text>

            {/* Pills: Charts | Option Chain  +  SL · TP toggle.
                BUY/SELL pills moved out — the big green BUY / red SELL
                action buttons at the bottom of the sheet are the only
                trade-fire affordance now. The pills row used to also
                show BUY/SELL as a side-state toggle, but it confused
                users into thinking they were a separate buy/sell entry
                point. Option Chain pill takes that slot — taps open
                the underlying's option chain so the user can switch
                from the spot quote into a strike with one tap. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 14,
              }}
            >
              <OutlinePill
                label="Charts"
                icon="stats-chart-outline"
                onPress={openChart}
              />
              <OutlinePill
                label="Option Chain"
                icon="layers-outline"
                onPress={openOptionChain}
              />
              <View style={{ flex: 1 }} />
              <SlTpToggle value={slTpEnabled} onChange={setSlTpEnabled} />
            </View>

            {/* LTP High / Low / Open / Last Trade.
                Values come from the /quote REST endpoint which the backend
                fills from Infoway for crypto / forex / metals / energy,
                and from Zerodha for NSE / BSE / NFO / MCX. Falls back to
                "—" while the quote hasn't landed yet (no misleading
                ₹0.00 placeholder). */}
            <View style={{ flexDirection: "row", marginTop: 16 }}>
              <KV
                label="LTP High"
                value={high > 0 ? formatNumber(high, 2) : "—"}
              />
              <KV
                label="LTP Low"
                value={low > 0 ? formatNumber(low, 2) : "—"}
              />
              <KV
                label="Open"
                value={open > 0 ? formatNumber(open, 2) : "—"}
              />
              <KV label="Last Trade" value={tick?.ts ? lastTradeTime : "—"} />
            </View>

            {/* Max Lots / Order Lots / Lot Size  +  Qty switch */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 18,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <KV
                label="Max Lots"
                value={
                  effective.data?.max_lot != null
                    ? String(effective.data.max_lot)
                    : "—"
                }
              />
              <KV label="Order Lots" value={lots || "—"} />
              <KV
                label="Lot Size"
                value={
                  effective.data?.lot_size != null
                    ? String(effective.data.lot_size)
                    : "—"
                }
              />
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                {/* LOT ⇄ QTY toggle. The pill label reads as the unit
                    the user would switch INTO on tap — so "Qty" while
                    in LOT mode, "Lot" while in QTY mode. Active state
                    (QTY) inherits the brand accent so the user can
                    tell at a glance which unit the input below shows. */}
                <Pressable
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setInputMode((m) => (m === "LOT" ? "QTY" : "LOT"));
                  }}
                  hitSlop={6}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor:
                      inputMode === "QTY" ? ACCENT_PURPLE : colors.border,
                    backgroundColor:
                      inputMode === "QTY" ? colors.bgElevated : "transparent",
                  }}
                >
                  <Ionicons
                    name="swap-horizontal"
                    size={14}
                    color={
                      inputMode === "QTY" ? ACCENT_PURPLE : colors.textMuted
                    }
                  />
                  <Text
                    size="xs"
                    style={{
                      marginLeft: 6,
                      fontWeight: "700",
                      color:
                        inputMode === "QTY" ? ACCENT_PURPLE : colors.text,
                    }}
                  >
                    {inputMode === "LOT" ? "Qty" : "Lot"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Price box + lot stepper */}
            <View style={{ flexDirection: "row", marginTop: 14 }}>
              <View
                style={{
                  flex: 1,
                  marginRight: 8,
                  backgroundColor: colors.bgElevated,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor:
                    mode === "limit" ? ACCENT_PURPLE : colors.border,
                  paddingVertical: mode === "limit" ? 10 : 14,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {mode === "limit" ? (
                  // Editable price for LIMIT orders. Backend's
                  // pending_order_poller (1.5 s loop) fires the order
                  // when LTP crosses this price — BUY fills at ≤ price,
                  // SELL fills at ≥ price.
                  <TextInput
                    value={limitPrice}
                    onChangeText={(v) => setLimitPrice(v.replace(/[^\d.]/g, ""))}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    placeholder={
                      ltp != null ? formatNumber(ltp, 2) : "Price"
                    }
                    placeholderTextColor={colors.textDim}
                    style={{
                      color: colors.text,
                      fontSize: 18,
                      fontWeight: "800",
                      textAlign: "center",
                      padding: 0,
                      minWidth: 90,
                    }}
                  />
                ) : (
                  <Text style={{ fontSize: 17, fontWeight: "700" }}>
                    Market
                  </Text>
                )}
                <Text
                  tone="muted"
                  size="xs"
                  style={{ marginTop: 2, letterSpacing: 0.6 }}
                >
                  PRICE
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  marginLeft: 8,
                  backgroundColor: colors.bgElevated,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 6,
                }}
              >
                <StepCircle dir="minus" onPress={() => bumpLots(-1)} />
                <View style={{ flex: 1, alignItems: "center" }}>
                  <TextInput
                    value={stepperDisplayValue}
                    onChangeText={onStepperChangeText}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    style={{
                      color: colors.text,
                      fontSize: 20,
                      fontWeight: "800",
                      textAlign: "center",
                      padding: 0,
                      minWidth: 40,
                    }}
                  />
                  <Text
                    tone="muted"
                    size="xs"
                    style={{ marginTop: -2, letterSpacing: 0.6 }}
                  >
                    {inputMode === "LOT" ? "LOT" : "QTY"}
                  </Text>
                </View>
                <StepCircle dir="plus" onPress={() => bumpLots(1)} />
              </View>
            </View>

            {/* Market | Limit segmented */}
            <View
              style={{
                flexDirection: "row",
                marginTop: 12,
                backgroundColor: colors.bgElevated,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 4,
              }}
            >
              <SegBtn
                label="Market"
                icon="flash"
                active={mode === "market"}
                onPress={() => setMode("market")}
              />
              <SegBtn
                label="Limit"
                icon="time-outline"
                active={mode === "limit"}
                onPress={() => {
                  setMode("limit");
                  // Seed the limit input with the side-quote the user is
                  // looking at. BUY → ask (max they want to pay); SELL →
                  // bid (min they want to receive). Falling back to LTP
                  // keeps the input non-empty even before WS first tick.
                  if (!limitPrice) {
                    const seed = side === "BUY" ? (ask ?? ltp) : (bid ?? ltp);
                    if (seed != null) setLimitPrice(seed.toFixed(2));
                  }
                }}
              />
            </View>

            {/* SL / TP inputs — appear only when the user toggles the
                SL · TP switch in the pills row. Backend auto-places the
                opposite-side bracket legs after the entry fills. */}
            {slTpEnabled ? (
              <View
                style={{
                  flexDirection: "row",
                  marginTop: 10,
                  gap: 8,
                }}
              >
                <BracketField
                  label="STOP LOSS"
                  placeholder={
                    bid != null && side === "BUY"
                      ? `< ${formatNumber(bid, 2)}`
                      : ask != null && side === "SELL"
                      ? `> ${formatNumber(ask, 2)}`
                      : "Optional"
                  }
                  value={stopLoss}
                  onChange={setStopLoss}
                  tone={SELL_RED}
                />
                <BracketField
                  label="TARGET"
                  placeholder={
                    ask != null && side === "BUY"
                      ? `> ${formatNumber(ask, 2)}`
                      : bid != null && side === "SELL"
                      ? `< ${formatNumber(bid, 2)}`
                      : "Optional"
                  }
                  value={takeProfit}
                  onChange={setTakeProfit}
                  tone={BUY_GREEN}
                />
              </View>
            ) : null}

            {/* 5-up KPI grid — HOLDING tile removed (always 0 for this
                broker today; misleading to show). INTRADAY now shows
                today's realised P&L pulled from /positions/pnl-summary
                so the trader sees their actual day's session result here
                instead of the previous placeholder "—". */}
            <View style={{ marginTop: 14, gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <KpiCell label="TOTAL BALANCE" value={compactINR(totalBalance)} />
                <KpiCell
                  label="EQUITY"
                  value={compactINR(equity)}
                  tone={m2m < 0 ? "sell" : "default"}
                />
                <KpiCell label="USED MARGIN" value={compactINR(used)} />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <KpiCell
                  label="INTRADAY"
                  value={compactINR(intradayPnl)}
                  tone={
                    intradayPnl > 0
                      ? "buy"
                      : intradayPnl < 0
                      ? "sell"
                      : "default"
                  }
                />
                <KpiCell
                  label="AVAILABLE"
                  value={compactINR(avail)}
                  tone="buy"
                />
              </View>
            </View>

            {/* Big BUY (green) / SELL (red) — instant fire */}
            <View style={{ flexDirection: "row", marginTop: 16 }}>
              <ActionButton
                kind="BUY"
                price={ask}
                onPress={() => fire("BUY")}
                style={{ marginRight: 6 }}
              />
              <ActionButton
                kind="SELL"
                price={bid}
                onPress={() => fire("SELL")}
                style={{ marginLeft: 6 }}
              />
            </View>
          </>
        ) : null}
      </BottomSheetView>
    </BottomSheet>
  );
});

function BracketField({
  label,
  placeholder,
  value,
  onChange,
  tone,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  tone: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgElevated,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 10,
        paddingVertical: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <View
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }}
        />
        <Text
          tone="dim"
          style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}
        >
          {label}
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^\d.]/g, ""))}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        keyboardType="decimal-pad"
        style={{
          color: colors.text,
          fontSize: 16,
          fontWeight: "700",
          padding: 0,
          marginTop: 4,
        }}
      />
    </View>
  );
}

function OutlinePill({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ marginRight: 6 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: colors.bgElevated,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={icon} size={13} color={colors.text} />
        <Text
          size="xs"
          style={{ marginLeft: 6, fontWeight: "700", color: colors.text }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function SidePill({
  label,
  icon,
  color,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ marginRight: 6 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: active ? color : colors.bgElevated,
          borderWidth: 1,
          borderColor: active ? color : colors.border,
        }}
      >
        <Ionicons name={icon} size={13} color={active ? "#fff" : color} />
        <Text
          size="xs"
          style={{
            marginLeft: 6,
            fontWeight: "800",
            color: active ? "#fff" : colors.text,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function SlTpToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onChange(!value)}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="locate-outline" size={13} color={colors.text} />
        <Text size="xs" style={{ marginHorizontal: 6, fontWeight: "700" }}>
          SL · TP
        </Text>
        <View
          style={{
            width: 26,
            height: 16,
            borderRadius: 8,
            padding: 2,
            backgroundColor: value ? BUY_GREEN : colors.bgSurface,
          }}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: "#fff",
              transform: [{ translateX: value ? 10 : 0 }],
            }}
          />
        </View>
      </View>
    </Pressable>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text tone="muted" size="xs">
        {label}
      </Text>
      <Text
        mono
        style={{ fontSize: 13, fontWeight: "700", marginTop: 2 }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function KpiCell({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "buy" | "sell";
}) {
  const color =
    tone === "buy" ? BUY_GREEN : tone === "sell" ? SELL_RED : colors.text;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgElevated,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 10,
        paddingVertical: 10,
      }}
    >
      <Text tone="dim" style={{ fontSize: 9.5, fontWeight: "700", letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text
        mono
        style={{ color, fontSize: 13, fontWeight: "800", marginTop: 4 }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function SegBtn({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 10,
          borderRadius: 8,
          backgroundColor: active ? ACCENT_PURPLE : "transparent",
        }}
      >
        <Ionicons
          name={icon}
          size={14}
          color={active ? "#fff" : colors.textMuted}
        />
        <Text
          style={{
            marginLeft: 6,
            fontWeight: "700",
            color: active ? "#fff" : colors.textMuted,
            fontSize: 14,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function StepCircle({
  dir,
  onPress,
}: {
  dir: "minus" | "plus";
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: colors.bgSurface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={dir === "plus" ? "add" : "remove"}
          size={18}
          color={colors.text}
        />
      </View>
    </Pressable>
  );
}

function ActionButton({
  kind,
  price,
  onPress,
  style,
}: {
  kind: OrderAction;
  price: number | null | undefined;
  onPress: () => void;
  style?: object;
}) {
  const bg = kind === "BUY" ? BUY_GREEN : SELL_RED;
  return (
    <Pressable onPress={onPress} style={[{ flex: 1 }, style]}>
      <View
        style={{
          backgroundColor: bg,
          borderRadius: 10,
          paddingVertical: 14,
          alignItems: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons
            name={kind === "BUY" ? "arrow-up-outline" : "arrow-down-outline"}
            size={16}
            color="#fff"
          />
          <Text
            style={{
              color: "#fff",
              fontSize: 16,
              fontWeight: "800",
              marginLeft: 6,
            }}
          >
            {kind}
          </Text>
        </View>
        <Text
          mono
          style={{
            color: "#fff",
            fontSize: 12,
            fontWeight: "700",
            marginTop: 2,
            opacity: 0.95,
          }}
        >
          {price != null ? formatNumber(price, 2) : "—"}
        </Text>
      </View>
    </Pressable>
  );
}

TradeSheet.displayName = "TradeSheet";

// Silenced unused — kept for potential INR-with-symbol formatting.
const _unused = { formatINR };
