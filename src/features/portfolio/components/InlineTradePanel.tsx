import { memo, useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radii, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { formatNumber } from "@shared/utils/format";
import { useTicker } from "@features/trade/hooks/useTicker";
import {
  pickDefaultLot,
  useEffectiveSettings,
} from "@features/trade/hooks/useEffectiveSettings";
import { usePlaceOrder } from "@features/trade/hooks/usePlaceOrder";
import { lookupInfowayLot } from "@features/trade/utils/infowayLots";
import { useWalletSummary } from "@features/wallet/hooks/useWallet";
import { useUiStore } from "@shared/store/ui.store";
import { sounds } from "@shared/services/sounds";

interface Props {
  /** Backend instrument token — drives the WS ticker + segment settings + order placement. */
  token: string;
  symbol: string;
  /** Current open quantity on the parent position. Powers the "Exit X Qty" red button. */
  positionQty: number;
  /** Direction the parent position is in. Used to pick the right default tab. */
  positionSide: "BUY" | "SELL";
  /** Called when the user taps "Exit X Qty" — usually the same close handler the row chevron uses. */
  onExit: () => void;
  closing?: boolean;
}

// Inline trade panel rendered under an expanded Position row. Lets the
// user TOP UP the position (BUY/SELL more lots), flip Market ↔ Limit
// orders, see live bid/ask + OHLC, and exit the position in one tap.
// Same hooks as the dedicated TradeSheet so behaviour is identical
// (instant tone + haptic, optimistic insert, error toast). Layout is a
// fresh take inspired by the user's reference screenshot rather than a
// pixel copy — adapts to mobile portrait with stacked rows.
function InlineTradePanelImpl({
  token,
  symbol,
  positionQty,
  positionSide,
  onExit,
  closing,
}: Props) {
  const [side, setSide] = useState<"BUY" | "SELL">(positionSide);
  const [mode, setMode] = useState<"market" | "limit">("market");
  const [lotsStr, setLotsStr] = useState<string>("1");
  const [limitPriceStr, setLimitPriceStr] = useState<string>("");
  // Same LOT ⇄ QTY toggle the Market-page TradeSheet uses. `lotsStr`
  // stays the canonical value; QTY mode just shows it multiplied by
  // `lot_size` and converts the typed value back on edit.
  const [inputMode, setInputMode] = useState<"LOT" | "QTY">("LOT");

  const tick = useTicker(token);
  const effective = useEffectiveSettings(token, side, "MIS");
  const place = usePlaceOrder();
  const wallet = useWalletSummary();
  const pushToast = useUiStore((s) => s.pushToast);

  // Seed lots input from admin segment-settings the first time effective
  // lands. Replaces "1" with whatever the admin's default is (NIFTY=1,
  // GOLD=0.01, etc.). Subsequent user edits aren't clobbered.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  useMemo(() => {
    if (effective.data && seededFor !== token) {
      setLotsStr(pickDefaultLot(effective.data));
      setSeededFor(token);
    }
  }, [effective.data, token, seededFor]);

  const bid = tick?.bid ?? tick?.ltp ?? 0;
  const ask = tick?.ask ?? tick?.ltp ?? 0;
  const ltp = tick?.ltp ?? 0;
  const high = tick?.high ?? 0;
  const low = tick?.low ?? 0;
  const open = tick?.open ?? 0;
  const ts = tick?.ts ?? Date.now();

  const maxLot = Number(effective.data?.max_lot ?? 0) || null;
  const orderLot = Number(effective.data?.order_lot ?? 0) || null;
  // Three-source lot_size resolution — see TradeSheet's `lotSizeForConv`
  // comment for the full rationale. Mirror the same priority here so a
  // pre-restart backend returning `lot_size = 1` for crypto/forex still
  // gives the user a working LOT⇄QTY toggle.
  const backendLotSize = Number(effective.data?.lot_size ?? 0);
  const fallbackLotSize = lookupInfowayLot(symbol) ?? lookupInfowayLot(token);
  const lotSize =
    backendLotSize > 1
      ? backendLotSize
      : fallbackLotSize && fallbackLotSize > 1
      ? fallbackLotSize
      : backendLotSize > 0
      ? backendLotSize
      : 1;
  const intradayLimit = Number(effective.data?.intraday_lot_limit ?? 0) || null;
  const availMargin = Number(wallet.data?.available_balance ?? 0);

  const lotsNum = Number(lotsStr);
  const lotsValid = Number.isFinite(lotsNum) && lotsNum > 0;

  function bumpLots(direction: 1 | -1) {
    void Haptics.selectionAsync();
    const step = lotSize >= 1 ? 1 : Math.max(0.01, lotSize);
    const next = Math.max(
      0.01,
      +((lotsNum || 0) + direction * step).toFixed(4),
    );
    setLotsStr(String(next));
  }

  // Display value for the lot input — `lotsStr` directly in LOT mode,
  // or `lotsNum × lot_size` in QTY mode (presented as a clean integer
  // where it can be — "100" instead of "100.0000" for whole contracts).
  const inputDisplayValue =
    inputMode === "QTY"
      ? (() => {
          if (!Number.isFinite(lotsNum) || !lotsNum) return "";
          const q = lotsNum * lotSize;
          return Number.isInteger(q) ? String(q) : String(+q.toFixed(3));
        })()
      : lotsStr;

  function onLotsInputChange(raw: string) {
    const clean = raw.replace(/[^\d.]/g, "");
    if (inputMode === "LOT") {
      setLotsStr(clean);
      return;
    }
    if (clean === "" || clean === ".") {
      setLotsStr("");
      return;
    }
    const qty = Number(clean);
    if (!Number.isFinite(qty)) return;
    const nextLots = +(qty / lotSize).toFixed(4);
    setLotsStr(String(nextLots));
  }

  function fire(action: "BUY" | "SELL") {
    if (!lotsValid) {
      pushToast({ kind: "warn", message: "Enter lots greater than 0" });
      return;
    }
    if (mode === "limit") {
      const lp = Number(limitPriceStr);
      if (!Number.isFinite(lp) || lp <= 0) {
        pushToast({ kind: "warn", message: "Enter a valid limit price" });
        return;
      }
    }
    if (action === "BUY") sounds.buy();
    else sounds.sell();
    place.mutate({
      token,
      action,
      order_type: mode === "market" ? "MARKET" : "LIMIT",
      product_type: "MIS",
      lots: lotsNum,
      price: mode === "limit" ? Number(limitPriceStr) : undefined,
      _displaySymbol: symbol,
    });
  }

  return (
    <View
      style={{
        marginTop: 6,
        backgroundColor: colors.bgSurface,
        borderRadius: radii.md,
        padding: spacing.sm,
        gap: 10,
      }}
    >
      {/* ── Top row: live bid/ask + Exit button ─────────────────────── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text mono style={{ color: colors.sell, fontSize: 16, fontWeight: "800" }}>
            {formatNumber(bid, 2)}
          </Text>
          <Ionicons name="swap-horizontal" size={12} color={colors.textDim} />
          <Text mono style={{ color: colors.buy, fontSize: 16, fontWeight: "800" }}>
            {formatNumber(ask, 2)}
          </Text>
        </View>
        <Pressable
          onPress={onExit}
          disabled={closing}
          hitSlop={6}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 6,
            backgroundColor: colors.sellDim,
            opacity: closing ? 0.55 : 1,
          }}
        >
          <Ionicons name="exit-outline" size={13} color={colors.sell} />
          <Text style={{ color: colors.sell, fontSize: 11, fontWeight: "800" }}>
            {closing ? "EXITING…" : `EXIT ${Math.abs(positionQty)} QTY`}
          </Text>
        </Pressable>
      </View>

      {/* ── LTP info grid: High · Low · Open · Last trade ───────────── */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Stat label="HIGH" value={high > 0 ? formatNumber(high, 2) : "—"} tone={colors.buy} />
        <Stat label="LOW" value={low > 0 ? formatNumber(low, 2) : "—"} tone={colors.sell} />
        <Stat label="OPEN" value={open > 0 ? formatNumber(open, 2) : "—"} />
        <Stat label="LAST" value={fmtTime(ts)} />
      </View>

      {/* ── Lot config strip — admin's per-segment caps ─────────────── */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Stat label="MAX LOTS" value={maxLot != null ? String(maxLot) : "—"} />
        <Stat label="ORDER LOTS" value={orderLot != null ? String(orderLot) : "—"} />
        <Stat label="LOT SIZE" value={String(lotSize)} />
      </View>

      {/* ── Mode selector — Market / Limit ─────────────────────────── */}
      <View style={{ flexDirection: "row", gap: 6 }}>
        <ModePill label="Market" active={mode === "market"} onPress={() => setMode("market")} />
        <ModePill label="Limit" active={mode === "limit"} onPress={() => setMode("limit")} />
      </View>

      {/* ── Inputs: lots (always) + limit price (only when Limit) ──── */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {mode === "limit" ? (
          <View style={{ flex: 1.2 }}>
            <Text size="xs" tone="dim" style={{ marginBottom: 4, fontWeight: "700" }}>
              LIMIT PRICE
            </Text>
            <TextInput
              value={limitPriceStr}
              onChangeText={setLimitPriceStr}
              keyboardType="decimal-pad"
              placeholder={formatNumber(ltp, 2)}
              placeholderTextColor={colors.textDim}
              style={{
                backgroundColor: colors.bgElevated,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
                fontSize: 14,
                fontWeight: "700",
                color: colors.text,
              }}
            />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          {/* Label row pairs the unit caption with the LOT⇄QTY pill so
              the user can flip units without losing context. Same
              affordance pattern the Market-page TradeSheet uses. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <Text size="xs" tone="dim" style={{ fontWeight: "700" }}>
              {inputMode === "LOT" ? "LOTS" : "QTY"}
            </Text>
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setInputMode((m) => (m === "LOT" ? "QTY" : "LOT"));
              }}
              hitSlop={6}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                borderWidth: 1,
                borderColor:
                  inputMode === "QTY" ? colors.primary : colors.border,
                backgroundColor:
                  inputMode === "QTY" ? colors.bgElevated : "transparent",
              }}
            >
              <Ionicons
                name="swap-horizontal"
                size={11}
                color={inputMode === "QTY" ? colors.primary : colors.textMuted}
              />
              <Text
                size="xs"
                style={{
                  fontWeight: "700",
                  color: inputMode === "QTY" ? colors.primary : colors.text,
                  fontSize: 10,
                }}
              >
                {inputMode === "LOT" ? "Qty" : "Lot"}
              </Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <StepBtn icon="remove" onPress={() => bumpLots(-1)} />
            <TextInput
              value={inputDisplayValue}
              onChangeText={onLotsInputChange}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={{
                flex: 1,
                textAlign: "center",
                backgroundColor: colors.bgElevated,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingVertical: 8,
                fontSize: 14,
                fontWeight: "700",
                color: colors.text,
              }}
            />
            <StepBtn icon="add" onPress={() => bumpLots(1)} />
          </View>
        </View>
      </View>

      {/* ── Margin / intraday-cap row ─────────────────────────────── */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        {intradayLimit != null ? (
          <Stat label="INTRADAY LIMIT" value={String(intradayLimit)} />
        ) : null}
        <Stat
          label="AVAILABLE MARGIN"
          value={`₹${formatNumber(availMargin, 0)}`}
          tone={colors.buy}
        />
      </View>

      {/* ── Big BUY / SELL action buttons — same hook as the chart bar */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => fire("SELL")}
          disabled={place.isPending}
          style={{
            flex: 1,
            backgroundColor: colors.sell,
            borderRadius: 8,
            paddingVertical: 12,
            alignItems: "center",
            opacity: place.isPending ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.6 }}>
            SELL
          </Text>
          <Text mono style={{ color: "#fff", fontWeight: "700", fontSize: 14, marginTop: 2 }}>
            {formatNumber(bid, 2)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => fire("BUY")}
          disabled={place.isPending}
          style={{
            flex: 1,
            backgroundColor: colors.buy,
            borderRadius: 8,
            paddingVertical: 12,
            alignItems: "center",
            opacity: place.isPending ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.6 }}>
            BUY
          </Text>
          <Text mono style={{ color: "#fff", fontWeight: "700", fontSize: 14, marginTop: 2 }}>
            {formatNumber(ask, 2)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text size="xs" tone="dim" style={{ fontWeight: "700", fontSize: 9, letterSpacing: 0.6 }}>
        {label}
      </Text>
      <Text
        mono
        style={{
          color: tone ?? colors.text,
          fontSize: 12,
          fontWeight: "700",
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ModePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View
        style={{
          paddingVertical: 8,
          alignItems: "center",
          borderRadius: 6,
          backgroundColor: active ? colors.primary : colors.bgElevated,
          borderWidth: 1,
          borderColor: active ? colors.primary : colors.border,
        }}
      >
        <Text
          size="xs"
          style={{
            color: active ? "#fff" : colors.textMuted,
            fontWeight: "700",
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function StepBtn({
  icon,
  onPress,
}: {
  icon: "add" | "remove";
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <View
        style={{
          width: 32,
          height: 36,
          borderRadius: 6,
          backgroundColor: colors.bgElevated,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={16} color={colors.text} />
      </View>
    </Pressable>
  );
}

function fmtTime(ms: number): string {
  try {
    const d = new Date(ms);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

export const InlineTradePanel = memo(InlineTradePanelImpl);
