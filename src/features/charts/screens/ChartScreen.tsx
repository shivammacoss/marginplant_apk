import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@shared/components/Screen";
import { Text } from "@shared/ui/Text";
import { colors } from "@shared/theme";
import { goBack } from "@shared/utils/navigation";
import { TradingViewChart } from "@features/charts/components/TradingViewChart";
import { NativeChart } from "@features/charts/components/NativeChart";
import { ChartInfoBar } from "@features/charts/components/ChartInfoBar";
import type { ChartInterval } from "@features/charts/hooks/useHistory";
import { InstrumentSearchOverlay } from "@features/trade/components/InstrumentSearchOverlay";
import {
  isResolvableToken,
  toTradingViewSymbol,
  tvDisplayToUnderlying,
} from "@features/charts/utils/tradingview";
import { BuySellBar } from "@features/trade/components/BuySellBar";
import { OptionChainAPI } from "@features/trade/api/market.api";
import {
  pickDefaultLot,
  pickMinLot,
  useEffectiveSettings,
} from "@features/trade/hooks/useEffectiveSettings";
import { useInstrumentLabel } from "@features/trade/hooks/useInstrument";
import {
  PositionRowV2,
  type PositionRowData,
} from "@features/portfolio/components/PositionRowV2";
import { SlTpEditor } from "@features/portfolio/components/SlTpEditor";
import {
  useOpenPositions,
  useSquareoffPosition,
  useUpdatePositionSlTp,
} from "@features/portfolio/hooks/usePositions";
import { useTickerStore } from "@features/trade/store/ticker.store";
import { useUiStore } from "@shared/store/ui.store";
import type { Position } from "@features/portfolio/types/position.types";

// Indian-exchange-backed (ZERODHA) instruments are the only ones that
// actually have a per-strike option chain on the backend — NFO/BFO list
// every NIFTY/RELIANCE/BANKNIFTY/SENSEX strike, MCX lists GOLD/CRUDE
// options. Infoway-fed crypto / forex / spot-commodity tickers do NOT
// have an option chain — `/option-chain/EURUSD` returns empty and the
// user lands on a blank "no options for EURUSD" page.
const OPTIONABLE_SOURCES = new Set(["ZERODHA"]);

// Quick segment + feed inference from a TradingView-style ticker so the
// chart info-bar can render the same "CRYPTO · INFOWAY" / "NSE · ZERODHA"
// tags the web app shows. Cheap heuristic — works for every symbol the
// platform supports today; falls back to undefined when in doubt.
function inferSegment(tvSymbol: string): { segment?: string; source?: string } {
  const prefix = tvSymbol.split(":")[0]?.toUpperCase() ?? "";
  if (prefix === "NSE" || prefix === "BSE") return { segment: prefix, source: "ZERODHA" };
  if (prefix === "MCX" || prefix === "NFO" || prefix === "BFO")
    return { segment: prefix, source: "ZERODHA" };
  if (prefix === "BINANCE") return { segment: "CRYPTO", source: "INFOWAY" };
  if (prefix === "OANDA" || prefix === "FX" || prefix === "FX_IDC")
    return { segment: "FOREX", source: "INFOWAY" };
  if (prefix === "TVC" || prefix === "COMEX" || prefix === "NYMEX")
    return { segment: "COMMODITY", source: "INFOWAY" };
  return {};
}

// When the user opens the Trade tab without picking an instrument, default to
// NIFTY 50 (Zerodha token 256265) so the chart, ticker, and buy/sell bar all
// line up out of the box.
const DEFAULT_TOKEN = "256265";

export function ChartScreen() {
  const params = useLocalSearchParams<{ symbol?: string; token?: string }>();
  const token = params.token ?? params.symbol ?? DEFAULT_TOKEN;

  // TradingView doesn't carry per-contract option charts. For unresolvable
  // tokens (numeric Zerodha tokens that aren't in our index map — i.e.
  // option / future contracts), we fetch the instrument's metadata and use
  // the UNDERLYING symbol (e.g. "NIFTY" for a NIFTY 23500 CE) so the chart
  // shows the underlying's price action instead of a junk fallback. The
  // BUY/SELL buttons keep showing the contract's live LTP — the user gets
  // the right chart AND the right tradable price together.
  const directlyResolvable = isResolvableToken(token);
  const instrumentLabel = useInstrumentLabel(directlyResolvable ? null : token);
  const isDerivative =
    !directlyResolvable && instrumentLabel.symbol !== token && !!instrumentLabel.name;
  // For derivatives, prefer the bare underlying `name` ("NIFTY") which the
  // TV resolver maps to NSE:NIFTY. For directly-resolvable tokens, just
  // pass them through.
  const chartToken = isDerivative ? instrumentLabel.name : token;
  const tvSymbol = toTradingViewSymbol(chartToken);
  const tvSymbolName = tvSymbol.split(":")[1] ?? tvSymbol;
  // Header title — keep the option's full symbol on derivatives so the
  // user knows which contract they're trading, even though the chart
  // underneath plots the underlying.
  const display = isDerivative
    ? (instrumentLabel.symbol || token)
    : tvDisplayToUnderlying(tvSymbolName);

  // Lots seeded from admin segment-settings — every instrument lands with
  // its own admin-configured default (NIFTY=1, GOLD=0.01, etc.) instead of
  // a hardcoded "0.01" that misleads users into thinking the lot is
  // sub-contract. Empty string until the effective settings resolve.
  const [lots, setLots] = useState("");
  const effective = useEffectiveSettings(token, "BUY", "MIS");
  useEffect(() => {
    if (effective.data && !lots) {
      setLots(pickDefaultLot(effective.data));
    }
    // We only seed when `lots` is still empty so a manual edit isn't
    // overwritten by a background settings refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective.data]);
  // Single source of truth for the chart interval — both TradingViewChart
  // (directly-resolvable tokens) and NativeChart (derivatives) read this
  // controlled prop, so the timeframe bar below works regardless of which
  // chart engine is mounted. Previously the bar lived inside
  // TradingViewChart and didn't render at all on option / future contracts.
  const [chartInterval, setChartInterval] = useState<ChartInterval>("5");
  // Bottom positions panel — collapsed by default so the chart gets full
  // vertical space. Chevron at the bottom toggles a 50/50 split between
  // the chart and the user's open positions (with live PnL + Close).
  const [panelOpen, setPanelOpen] = useState(false);
  // Inline instrument-search modal — replaces the old `/search` route.
  // Tap header magnifier → overlay slides up over the chart, user picks
  // a symbol, taps a result → overlay closes + chart navigates to the
  // new token. Same backend search logic as the Market page.
  const [searchOpen, setSearchOpen] = useState(false);
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  // For derivatives the bare underlying ("NIFTY") is already in the
  // instrument metadata; use it so the option-chain prefetch + the
  // Options pill route target the underlying, not the option's full
  // trading symbol.
  const underlying = isDerivative
    ? instrumentLabel.name
    : tvDisplayToUnderlying(tvSymbolName);
  const segmentTags = useMemo(() => inferSegment(tvSymbol), [tvSymbol]);

  const intervalLabel =
    chartInterval === "1D" ? "1D"
    : chartInterval === "60" ? "1h"
    : `${chartInterval}m`;

  useEffect(() => {
    if (!underlying) return;
    void qc.prefetchQuery({
      queryKey: ["option-chain", underlying, ""],
      queryFn: () => OptionChainAPI.fetch(underlying),
      staleTime: 2_500,
    });
  }, [underlying, qc]);

  return (
    <Screen padded={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 10,
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        <Pressable onPress={() => goBack("/(tabs)")} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: "600" }} numberOfLines={1}>
            {display}
          </Text>
          <Text tone="muted" size="xs" numberOfLines={1}>
            {isDerivative
              ? `${instrumentLabel.name} · live`
              : tvSymbol}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            // Only Indian-exchange (NSE/BSE/MCX) instruments have an
            // option chain on the backend. For Infoway-fed crypto /
            // forex / spot-commodity tickers (BINANCE / OANDA / TVC),
            // pushing into /option-chain returns empty and the user
            // sees a blank screen — surface a toast instead so they
            // know the feature isn't supported for that instrument.
            const optionable =
              segmentTags.source != null &&
              OPTIONABLE_SOURCES.has(segmentTags.source);
            if (!optionable) {
              pushToast({
                kind: "warn",
                message: `Options not available for ${display}`,
                ttlMs: 2000,
              });
              return;
            }
            router.push(`/option-chain/${encodeURIComponent(underlying)}`);
          }}
          hitSlop={10}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: colors.bgElevated,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="options-outline" size={14} color={colors.text} />
          <Text size="xs" style={{ fontWeight: "600" }}>
            Options
          </Text>
        </Pressable>
        <Pressable onPress={() => setSearchOpen(true)} hitSlop={10}>
          <Ionicons name="search" size={20} color={colors.text} />
        </Pressable>
      </View>

      <InstrumentSearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      <BuySellBar
        token={token}
        symbol={display}
        lots={lots}
        onLotsChange={setLots}
        minLots={pickMinLot(effective.data)}
        step={pickMinLot(effective.data) >= 1 ? 1 : pickMinLot(effective.data)}
      />

      <ChartInfoBar
        token={token}
        symbol={display}
        interval={intervalLabel}
        segment={segmentTags.segment}
        source={segmentTags.source}
      />

      {/* Chart — grows to fill the available area when the bottom panel is
          collapsed, shrinks to ~half when expanded so positions get room.
          Two chart engines:
            • Directly-resolvable tokens (NIFTY, BTCUSD, XAUUSD, RELIANCE)
              go through the free TradingView widget — best UX, free tier.
            • Derivatives (options / futures with arbitrary numeric tokens)
              go through NativeChart, which fetches OHLC straight from the
              backend's /history endpoint and renders Lightweight-Charts
              candles. This way the option's OWN price chart shows on
              screen instead of an unrelated TradingView fallback. */}
      <View style={{ flex: 1, minHeight: 0 }}>
        {isDerivative ? (
          <NativeChart
            token={token}
            interval={chartInterval}
            displaySymbol={display}
          />
        ) : (
          <TradingViewChart
            token={token}
            symbol={display}
            interval={chartInterval}
          />
        )}
      </View>

      {/* Screen-level timeframe bar — works for BOTH chart engines and
          is the only source of truth for `chartInterval`. */}
      <IntervalBar value={chartInterval} onChange={setChartInterval} />

      {/* Chevron toggle — splits the screen into chart + positions when
          tapped. Sits between chart and panel so it's always reachable. */}
      <PanelToggle
        open={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
      />

      {/* Positions panel — claims `flex: 1` so it shares the remaining
          vertical space evenly with the chart above. Hidden entirely
          when collapsed so the chart fills the screen. */}
      {panelOpen ? (
        <View style={{ flex: 1, minHeight: 0 }}>
          <PositionsPanel />
        </View>
      ) : null}
    </Screen>
  );
}

const CHART_INTERVALS: { id: ChartInterval; label: string }[] = [
  { id: "1", label: "1m" },
  { id: "5", label: "5m" },
  { id: "15", label: "15m" },
  { id: "60", label: "1h" },
  { id: "1D", label: "1D" },
];

function IntervalBar({
  value,
  onChange,
}: {
  value: ChartInterval;
  onChange: (v: ChartInterval) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 8,
        backgroundColor: colors.bg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {CHART_INTERVALS.map((iv) => {
        const active = iv.id === value;
        return (
          <Pressable
            key={iv.id}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(iv.id);
            }}
            hitSlop={6}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 6,
              backgroundColor: active ? colors.bgElevated : "transparent",
            }}
          >
            <Text
              size="xs"
              style={{
                color: active ? colors.primary : colors.textMuted,
                fontWeight: active ? "700" : "500",
              }}
            >
              {iv.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PanelToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 6,
          gap: 6,
          backgroundColor: colors.bgElevated,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          borderBottomWidth: open ? 1 : 0,
          borderBottomColor: colors.border,
        }}
      >
        <Ionicons
          name={open ? "chevron-down" : "chevron-up"}
          size={16}
          color={colors.textMuted}
        />
        <Text size="xs" tone="muted" style={{ fontWeight: "700", letterSpacing: 0.6 }}>
          {open ? "HIDE POSITIONS" : "SHOW POSITIONS"}
        </Text>
      </View>
    </Pressable>
  );
}

// Lives in the bottom half of the chart screen when the user opens the
// panel. Renders every open position with live PnL (overlaid from the
// WS ticker store so the number ticks even between REST refetches), a
// one-tap Close button, AND a SL · TP edit pill that mounts the same
// editor sheet the Portfolio tab uses. Tapping the row navigates to
// the Portfolio tab for the full view.
function PositionsPanel() {
  const positions = useOpenPositions();
  const squareoff = useSquareoffPosition();
  const updatePosSlTp = useUpdatePositionSlTp();
  const rows = positions.data ?? [];

  // SL/TP editor state — opens with the tapped row's current values.
  // Same pattern as PortfolioScreen so behaviour is identical across
  // both entry points.
  const [slTpEditing, setSlTpEditing] = useState<PositionRowData | null>(null);
  const onSaveSlTp = (input: { stop_loss: number | null; target: number | null }) => {
    const r = slTpEditing;
    if (!r) return;
    updatePosSlTp.mutate({
      id: r.id,
      stop_loss: input.stop_loss,
      target: input.target,
    });
    setSlTpEditing(null);
  };

  if (positions.isLoading && rows.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text tone="muted" size="sm">
          Loading positions…
        </Text>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Ionicons name="briefcase-outline" size={26} color={colors.textDim} />
        <Text tone="muted" size="sm">
          No open positions
        </Text>
        <Pressable
          onPress={() => router.push("/(tabs)/portfolio")}
          hitSlop={8}
        >
          <Text
            size="xs"
            style={{ color: colors.primary, fontWeight: "700", marginTop: 2 }}
          >
            Go to Portfolio →
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 14,
          paddingVertical: 8,
          backgroundColor: colors.bg,
        }}
      >
        <Text size="xs" style={{ fontWeight: "800", letterSpacing: 0.6 }}>
          OPEN POSITIONS · {rows.length}
        </Text>
        <Pressable
          onPress={() => router.push("/(tabs)/portfolio")}
          hitSlop={8}
        >
          <Text size="xs" style={{ color: colors.primary, fontWeight: "700" }}>
            View all →
          </Text>
        </Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}
        renderItem={({ item }) => (
          <LivePositionRow
            position={item}
            closing={
              squareoff.isPending && squareoff.variables?.id === item.id
            }
            onClose={() => squareoff.mutate({ id: item.id })}
            onEditSlTp={(row) => setSlTpEditing(row)}
          />
        )}
      />
      {/* SL/TP bottom sheet — same editor the Portfolio tab uses, so a
          stop loss set from here lands in /positions/{id}/sl-tp exactly
          like it would from Portfolio → SL·TP. */}
      <SlTpEditor
        visible={slTpEditing != null}
        symbol={slTpEditing?.symbol ?? ""}
        instrumentToken={slTpEditing?.instrument_token ?? null}
        side={slTpEditing?.side ?? "BUY"}
        entryPrice={slTpEditing?.entry_price ?? 0}
        ltp={slTpEditing?.ltp ?? 0}
        initialStopLoss={slTpEditing?.stop_loss}
        initialTarget={slTpEditing?.target}
        saving={updatePosSlTp.isPending}
        onClose={() => setSlTpEditing(null)}
        onSave={onSaveSlTp}
      />
    </View>
  );
}

// Position row wrapped with a live LTP / PnL recompute from the ticker
// store — so the number ticks between REST refetches and feels alive.
function LivePositionRow({
  position,
  closing,
  onClose,
  onEditSlTp,
}: {
  position: Position;
  closing: boolean;
  onClose: () => void;
  onEditSlTp: (row: PositionRowData) => void;
}) {
  const tick = useTickerStore((s) =>
    position.instrument_token ? s.ticks[position.instrument_token] : undefined,
  );
  const ltp = tick?.ltp ?? Number(position.ltp);
  const avg = Number(position.avg_price);
  const qty = position.quantity;
  // Live unrealised P&L = (ltp - avg) × qty + already-booked realised.
  // For USD-quoted instruments the backend FX-converts on its next REST
  // poll (3s); this local recompute is best-effort native-currency only,
  // which is still directionally correct between polls.
  const livePnl =
    Number.isFinite(ltp) && Number.isFinite(avg)
      ? (ltp - avg) * qty + Number(position.realized_pnl ?? 0)
      : Number(position.unrealized_pnl ?? 0);

  const row: PositionRowData = {
    id: position.id,
    instrument_token: position.instrument_token,
    symbol: position.symbol,
    exchange: position.exchange,
    side: qty > 0 ? "BUY" : "SELL",
    quantity: Math.abs(qty),
    entry_price: avg,
    ltp,
    pnl: livePnl,
    status: position.status,
    timestamp: position.opened_at,
    currency_quote: position.currency_quote,
    bid_or_ask: qty > 0 ? "BID" : "ASK",
    stop_loss: position.stop_loss,
    target: position.target,
  };

  return (
    <PositionRowV2
      row={row}
      closing={closing}
      onEditSlTp={position.status === "OPEN" ? () => onEditSlTp(row) : undefined}
      onClose={position.status === "OPEN" ? onClose : undefined}
      onPress={() => router.push("/(tabs)/portfolio")}
    />
  );
}
