import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { IllustrationEmpty } from "@shared/components/IllustrationEmpty";
import { SketchIllustration } from "@shared/components/SketchIllustration";
import { Tabs, type TabItem } from "@shared/ui/Tabs";
import { GradientButton } from "@shared/ui/GradientButton";
import { Text } from "@shared/ui/Text";
import { colors, radii, spacing } from "@shared/theme";
import { useManualRefresh } from "@shared/hooks/useManualRefresh";
import {
  useActiveTrades,
  useCloseActiveTrade,
  useClosedPositions,
  useOpenPositions,
  usePnLSummary,
  useSquareoffAll,
  useSquareoffPosition,
  useUpdateActiveTradeSlTp,
  useUpdatePositionSlTp,
} from "@features/portfolio/hooks/usePositions";
import { SlTpEditor } from "@features/portfolio/components/SlTpEditor";
import { PositionTradeSheet } from "@features/portfolio/components/PositionTradeSheet";
import { useWalletSummary } from "@features/wallet/hooks/useWallet";
import {
  TotalPnLCard,
  WalletKpiStrip,
} from "@features/portfolio/components/WalletKpiStrip";
import {
  PositionRowV2,
  type PositionRowData,
} from "@features/portfolio/components/PositionRowV2";
import type {
  ActiveTrade,
  Position,
} from "@features/portfolio/types/position.types";
import { useTickerStore } from "@features/trade/store/ticker.store";
import { useTickerSubscription } from "@features/trade/hooks/useTickers";

type TabKey = "position" | "active" | "closed";

// Quick filter applied on top of the tab's rows. Mirrors the same set
// available on the Orders → Executed tab so the user sees a consistent
// affordance across both screens.
//   all   — every row (no filter)
//   buy   — only rows whose side is BUY
//   sell  — only rows whose side is SELL
//   sltp  — only rows that have a stop-loss OR target attached
type SideFilter = "all" | "buy" | "sell" | "sltp";

function matchesFilter(row: PositionRowData, f: SideFilter): boolean {
  if (f === "all") return true;
  if (f === "buy") return row.side === "BUY";
  if (f === "sell") return row.side === "SELL";
  // "sltp" — matches either:
  //   • an OPEN row that currently has a bracket leg attached, OR
  //   • a CLOSED row whose `close_reason` is SL_HIT / TP_HIT (the
  //     bracket fields are cleared on close, so the live-leg check
  //     above would miss historical bracket exits — exactly the bug
  //     the user reported: "Closed tab me SL/TP filter pe trades
  //     nahi aa rahi").
  const hasActiveLeg =
    (row.stop_loss != null && row.stop_loss !== "") ||
    (row.target != null && row.target !== "");
  const closedByBracket =
    row.close_reason === "SL_HIT" || row.close_reason === "TP_HIT";
  return hasActiveLeg || closedByBracket;
}

function posToRow(p: Position): PositionRowData {
  // On CLOSED rows we want the closed_at timestamp + the close_reason
  // tag, so the Closed tab card can show "Closed by SL · 14:32:11".
  // On OPEN rows we keep opened_at and leave close_reason null.
  const isClosed = p.status === "CLOSED";
  // Prefer the backend's stamped `opened_side` over inferring from
  // `quantity` — on CLOSED rows quantity is 0 and the sign-based fallback
  // wrongly returned "SELL" for every closed BUY position (the bug
  // reported as "BUY karta hu but Closed me SELL dikhta hai"). For OPEN
  // rows opened_side and quantity-sign agree.
  const side: "BUY" | "SELL" =
    p.opened_side === "BUY" || p.opened_side === "SELL"
      ? p.opened_side
      : p.quantity > 0
      ? "BUY"
      : "SELL";
  // On CLOSED rows the live `quantity` is 0 (the position is flat). The
  // Closed-tab card needs to show the size the user actually traded, so
  // fall back to `opening_quantity` (peak abs(qty) the server preserves
  // across the close). Without this the "×0" pill the user reported
  // showed up on every closed row.
  const effectiveQty = isClosed
    ? Math.abs(p.opening_quantity ?? p.quantity)
    : Math.abs(p.quantity);

  // Lot count = absolute contracts / lot_size. Prefer the backend's
  // `lots` field when present (server already does this division and
  // carries the canonical lot table for index F&O), fall back to a
  // local divide. Use `effectiveQty` so closed rows derive lots from
  // their opening quantity, not the post-close 0.
  const lotSize = Number(p.lot_size ?? 0) || 0;
  const lotsFromQty = lotSize > 0 ? effectiveQty / lotSize : null;
  const lotsCount = (p.lots ?? lotsFromQty) ?? undefined;

  // P&L: for OPEN rows show ONLY `unrealized_pnl` (matches what the
  // Active tab shows + what the user expects as "current floating P&L").
  // Adding realized double-counted the locked-in profit from any prior
  // partial close — e.g. a 4-lot GOLD with 1 lot already closed showed
  // 4 lots' worth of P&L on the 3 remaining (realized + unrealized for
  // 3 lots = unrealized for 4 lots numerically).
  //
  // For CLOSED rows `unrealized_pnl` is 0 by definition so we use
  // `realized_pnl` which is the final settled P&L for that position's
  // entire life.
  const pnlValue = isClosed
    ? Number(p.realized_pnl)
    : Number(p.unrealized_pnl);

  return {
    id: p.id,
    instrument_token: p.instrument_token,
    symbol: p.symbol,
    exchange: p.exchange,
    side,
    quantity: effectiveQty,
    lots: lotsCount != null ? Number(lotsCount) : undefined,
    entry_price: Number(p.avg_price),
    ltp: Number(p.ltp),
    pnl: pnlValue,
    status: p.status,
    timestamp: isClosed
      ? p.closed_at ?? p.opened_at ?? null
      : p.opened_at ?? null,
    expiry_label: p.exchange,
    currency_quote: p.currency_quote,
    bid_or_ask: side === "BUY" ? "BID" : "ASK",
    stop_loss: p.stop_loss ?? null,
    target: p.target ?? null,
    close_reason: p.close_reason ?? null,
  };
}

function tradeToRow(t: ActiveTrade): PositionRowData {
  return {
    id: t.id,
    instrument_token: t.instrument_token,
    symbol: t.symbol,
    exchange: t.exchange,
    side: t.action,
    quantity: t.quantity,
    lots: t.lots,
    entry_price: Number(t.price),
    ltp: Number(t.ltp),
    pnl: Number(t.pnl),
    status: "OPEN",
    timestamp: t.executed_at,
    expiry_label: t.exchange,
    currency_quote: t.currency_quote,
    bid_or_ask: t.action === "BUY" ? "BID" : "ASK",
    stop_loss: t.stop_loss ?? null,
    target: t.target ?? null,
  };
}

export function PortfolioScreen() {
  const [tab, setTab] = useState<TabKey>("position");
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  // In-tab local search — filters the CURRENT tab's rows by symbol /
  // exchange. Previously the magnifier icon routed to the global stock
  // search (`/search`) which the user found confusing — they wanted
  // to find their own POSITIONS, not browse instruments. Now it stays
  // on the Portfolio page and just narrows whatever tab is open.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const wallet = useWalletSummary();
  const pnl = usePnLSummary();
  const openPositions = useOpenPositions();
  const closedPositions = useClosedPositions();
  const activeTrades = useActiveTrades();

  // Subscribe every open-position instrument to the marketdata WS so the
  // row's <LivePositionRow> wrapper can recompute P/L from real-time ticks
  // — that's what makes a freshly placed trade's P/L start ticking within
  // ~100-300 ms instead of waiting on the 3-5 s positions refetch. Without
  // this, the ticker store has no data for newly-traded tokens and the
  // P/L stays at the server-cached value (initial 0) until the next poll.
  const liveTokens = useMemo(() => {
    const out: string[] = [];
    for (const p of openPositions.data ?? []) {
      if (p.instrument_token) out.push(String(p.instrument_token));
    }
    for (const t of activeTrades.data ?? []) {
      if (t.instrument_token) out.push(String(t.instrument_token));
    }
    return Array.from(new Set(out));
  }, [openPositions.data, activeTrades.data]);
  useTickerSubscription(liveTokens);

  const squareoff = useSquareoffPosition();
  const closeTrade = useCloseActiveTrade();
  const squareoffAll = useSquareoffAll();
  const updatePosSlTp = useUpdatePositionSlTp();
  const updateTradeSlTp = useUpdateActiveTradeSlTp();

  // SL/TP editor — opens with the tapped row's current values.
  const [slTpEditing, setSlTpEditing] = useState<PositionRowData | null>(null);
  const onEditSlTp = useCallback((r: PositionRowData) => {
    setSlTpEditing(r);
  }, []);

  // Floating trade sheet for tapped Position rows. We store ONLY the id,
  // then derive the live row from `rowsForTab` below. Storing the whole
  // snapshot meant the sheet showed the row's value at TAP TIME and never
  // updated when the user placed another order from inside the sheet —
  // that's the "buy karne ke baad update slow" symptom. With an id +
  // live lookup, the sheet's header qty/lots/P&L tick whenever the
  // underlying cache changes (optimistic insert from usePlaceOrder, WS
  // push from UserEventsProvider, REST refetch). null = sheet closed.
  const [tradeForId, setTradeForId] = useState<string | null>(null);
  const onRowTap = useCallback(
    (r: PositionRowData) => {
      if (r.status === "OPEN" && r.instrument_token) {
        setTradeForId(r.id);
      } else {
        // CLOSED row → open the full trade-detail page for this
        // position so the user can review every field (entry, exit,
        // P&L breakdown, charges, margin, close reason, hold time,
        // SL/TP, USD/INR rates). The chart is reachable via the
        // "View chart" action button inside the detail page.
        router.push({ pathname: "/positions/[id]", params: { id: r.id } });
      }
    },
    [],
  );
  const onSaveSlTp = useCallback(
    (input: { stop_loss: number | null; target: number | null }) => {
      const r = slTpEditing;
      if (!r) return;
      const args = {
        stop_loss: input.stop_loss,
        target: input.target,
      };
      // Pick the right mutation based on which tab we're on. Active tab
      // rows are per-fill trades, every other tab row is an aggregated
      // position.
      if (tab === "active") {
        updateTradeSlTp.mutate({ tradeId: r.id, ...args });
      } else {
        updatePosSlTp.mutate({ id: r.id, ...args });
      }
      setSlTpEditing(null);
    },
    [slTpEditing, tab, updateTradeSlTp, updatePosSlTp],
  );

  const openRows = openPositions.data ?? [];
  const closedRows = closedPositions.data ?? [];
  const activeRows = activeTrades.data ?? [];

  const rowsForTab: PositionRowData[] = useMemo(() => {
    const base =
      tab === "position"
        ? openRows.map(posToRow)
        : tab === "closed"
        ? closedRows.map(posToRow)
        : activeRows.map(tradeToRow);
    let filtered = sideFilter === "all"
      ? base
      : base.filter((r) => matchesFilter(r, sideFilter));
    // Local symbol/exchange search — narrows the current tab's rows
    // only. Doesn't fetch new stocks or open a global picker.
    const q = searchQuery.trim().toUpperCase();
    if (q.length > 0) {
      filtered = filtered.filter((r) => {
        const sym = (r.symbol ?? "").toUpperCase();
        const exch = (r.exchange ?? "").toUpperCase();
        return sym.includes(q) || exch.includes(q);
      });
    }
    return filtered;
  }, [tab, sideFilter, openRows, closedRows, activeRows, searchQuery]);

  const totalPnL = useMemo(
    () => rowsForTab.reduce((sum, r) => sum + r.pnl, 0),
    [rowsForTab],
  );

  // Look up the live row for the sheet (qty / lots / P&L all reflect
  // the latest React-Query cache). If the position was fully closed
  // while the sheet was open, the lookup returns undefined and the
  // sheet auto-closes via the null prop.
  const tradeForRow = useMemo(
    () => (tradeForId ? rowsForTab.find((r) => r.id === tradeForId) ?? null : null),
    [tradeForId, rowsForTab],
  );

  // Tab order per user request: Position → Active → Closed
  const tabs: TabItem[] = useMemo(
    () => [
      { key: "position", label: `Positions (${openRows.length})` },
      { key: "active", label: `Active (${activeRows.length})` },
      { key: "closed", label: `Closed (${closedRows.length})` },
    ],
    [openRows.length, activeRows.length, closedRows.length],
  );

  // Instant close — no Alert.alert. Tap fires the squareoff immediately;
  // PositionRowV2 already shows a "Closing…" state during the mutation.
  //
  // `useCallback` is critical here — without it, every parent re-render
  // creates a new function ref, defeating PositionRowV2's `memo()` and
  // causing all open position rows to re-render on every tick.
  const onCloseRow = useCallback(
    (r: PositionRowData) => {
      if (tab === "active") {
        closeTrade.mutate(r.id);
      } else {
        squareoff.mutate({ id: r.id });
      }
    },
    [tab, closeTrade, squareoff],
  );

  function onBatchClose() {
    if (openRows.length === 0) return;
    squareoffAll.mutate();
  }

  const tabLoading =
    (tab === "position" && openPositions.isLoading) ||
    (tab === "closed" && closedPositions.isLoading) ||
    (tab === "active" && activeTrades.isLoading);
  const tabError =
    (tab === "position" && openPositions.isError) ||
    (tab === "closed" && closedPositions.isError) ||
    (tab === "active" && activeTrades.isError);

  // Manual-pull spinner only. Shared hook (see useManualRefresh) — same
  // pattern used across every list in the app.
  const { refreshing, onRefresh } = useManualRefresh(async () => {
    await Promise.all([
      wallet.refetch(),
      pnl.refetch(),
      openPositions.refetch(),
      closedPositions.refetch(),
      activeTrades.refetch(),
    ]);
  });

  const isBatchPending = squareoffAll.isPending;
  const showBatch = tab === "position" && openRows.length > 0;
  const showTotalPnL = rowsForTab.length > 0;

  return (
    <Screen padded={false}>
      <FlatList<PositionRowData>
        data={rowsForTab}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        ListHeaderComponent={
          <View>
            <WalletKpiStrip wallet={wallet.data} pnl={pnl.data} />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.sm,
                paddingBottom: spacing.sm,
              }}
            >
              <Text style={{ fontSize: 24, fontWeight: "800" }}>Portfolio</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {showBatch ? (
                  <Pressable
                    onPress={onBatchClose}
                    disabled={isBatchPending}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.sell,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      opacity: isBatchPending ? 0.6 : 1,
                      marginRight: 8,
                    }}
                  >
                    <Ionicons
                      name="layers-outline"
                      size={14}
                      color="#fff"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                      {isBatchPending ? "Closing…" : "Close All"}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  hitSlop={6}
                  onPress={() => {
                    // Toggle the in-tab search bar. Closing clears the
                    // query so the next open starts fresh (and the rows
                    // aren't silently filtered after the bar is gone).
                    setSearchOpen((v) => {
                      if (v) setSearchQuery("");
                      return !v;
                    });
                  }}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: searchOpen ? colors.primaryDim : colors.bgElevated,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: searchOpen ? colors.primary : colors.border,
                  }}
                >
                  <Ionicons
                    name={searchOpen ? "close" : "search"}
                    size={16}
                    color={searchOpen ? colors.primary : colors.text}
                  />
                </Pressable>
              </View>
            </View>
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.sm,
              }}
            >
              <Tabs
                items={tabs}
                activeKey={tab}
                onChange={(k) => setTab(k as TabKey)}
                variant="underline"
              />
            </View>
            {/* Inline search bar — only mounts when user taps the
                magnifier. Filters CURRENT tab's positions only; doesn't
                fetch / browse new stocks. */}
            {searchOpen ? (
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingBottom: spacing.sm,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.bgElevated,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="search" size={14} color={colors.textMuted} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search your positions (symbol / exchange)"
                    placeholderTextColor={colors.textDim}
                    autoFocus
                    autoCapitalize="characters"
                    autoCorrect={false}
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: colors.text,
                      padding: 0,
                    }}
                  />
                  {searchQuery.length > 0 ? (
                    <Pressable
                      onPress={() => setSearchQuery("")}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
            {/* Side filter — works on every tab. SL/TP filter is only
                meaningful on tabs that carry bracket-leg metadata
                (Position + Active), but we leave it visible on Closed
                too so the user can see which closes were SL/TP-driven. */}
            <View style={{ paddingBottom: spacing.sm }}>
              <SideFilterChips
                active={sideFilter}
                onChange={setSideFilter}
              />
            </View>
            {showTotalPnL ? (
              <View style={{ paddingTop: spacing.sm }}>
                <TotalPnLCard value={totalPnL} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          tabLoading ? (
            // Minimal inline skeleton — NOT a centred full-screen spinner.
            // Auth-time prefetch (AuthProvider) usually fills the cache
            // before the user lands here, so this placeholder is only ever
            // visible on a truly cold first-ever open (< 50 ms typically).
            <View style={{ paddingHorizontal: spacing.lg, gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={{
                    height: 96,
                    borderRadius: radii.lg,
                    backgroundColor: colors.bgElevated,
                    opacity: 0.5 - i * 0.12,
                  }}
                />
              ))}
            </View>
          ) : tabError ? (
            <IllustrationEmpty
              illustration={<SketchIllustration kind="briefcase" />}
              title="Couldn't load data"
              description="Please pull to refresh."
            />
          ) : tab === "active" ? (
            <EmptyHint
              icon="pulse-outline"
              title="No active trades"
              hint="Per-fill view of currently-open exposure appears here."
            />
          ) : tab === "closed" ? (
            <EmptyHint
              icon="checkmark-done-outline"
              title="No closed positions"
              hint="Squared-off positions will appear here."
            />
          ) : (
            <IllustrationEmpty
              illustration={<SketchIllustration kind="briefcase" />}
              title="No open positions"
              description="Open positions appear here as soon as you place a trade."
              action={
                <View style={{ width: 220 }}>
                  <GradientButton
                    label="Place a trade"
                    onPress={() => router.push("/(tabs)/trade")}
                  />
                </View>
              }
            />
          )
        }
        renderItem={({ item }) => (
          <LivePositionRow
            row={item}
            onPress={() => onRowTap(item)}
            onClose={() => onCloseRow(item)}
            onEditSlTp={
              tab === "closed" ? undefined : () => onEditSlTp(item)
            }
            closing={
              (tab === "active" &&
                closeTrade.isPending &&
                closeTrade.variables === item.id) ||
              ((tab === "position" || tab === "closed") &&
                squareoff.isPending &&
                squareoff.variables?.id === item.id)
            }
          />
        )}
      />
      {/* Floating trade panel — pops up on row tap. Sits on top of the
          list so the position card behind stays at its normal size.
          `position` is derived from rowsForTab so qty/lots/P&L stay
          live as the underlying cache updates (optimistic top-up,
          WS push, REST refetch). */}
      <PositionTradeSheet
        position={tradeForRow}
        onClose={() => setTradeForId(null)}
        onExitPosition={() => {
          if (tradeForRow) {
            onCloseRow(tradeForRow);
            setTradeForId(null);
          }
        }}
        closing={
          tradeForRow != null &&
          ((tab === "active" &&
            closeTrade.isPending &&
            closeTrade.variables === tradeForRow.id) ||
            (squareoff.isPending && squareoff.variables?.id === tradeForRow.id))
        }
      />
      {/* SL / TP bottom-sheet — shown for both Position + Active rows */}
      <SlTpEditor
        visible={slTpEditing != null}
        symbol={slTpEditing?.symbol ?? ""}
        instrumentToken={slTpEditing?.instrument_token ?? null}
        side={slTpEditing?.side ?? "BUY"}
        entryPrice={slTpEditing?.entry_price ?? 0}
        ltp={slTpEditing?.ltp ?? 0}
        initialStopLoss={slTpEditing?.stop_loss}
        initialTarget={slTpEditing?.target}
        saving={updatePosSlTp.isPending || updateTradeSlTp.isPending}
        onClose={() => setSlTpEditing(null)}
        onSave={onSaveSlTp}
      />
    </Screen>
  );
}

// 4-pill horizontal strip — All / Buy / Sell / SL TP. Tonal hints match
// the app palette (buy=teal, sell=pink, primary=purple) so the active
// pill instantly tells the user which filter they're on without reading
// the label.
function SideFilterChips({
  active,
  onChange,
}: {
  active: SideFilter;
  onChange: (next: SideFilter) => void;
}) {
  const pills: { key: SideFilter; label: string; tone: "neutral" | "buy" | "sell" | "primary" }[] = [
    { key: "all", label: "All", tone: "neutral" },
    { key: "buy", label: "Buy", tone: "buy" },
    { key: "sell", label: "Sell", tone: "sell" },
    { key: "sltp", label: "SL · TP", tone: "primary" },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: spacing.lg,
      }}
    >
      {pills.map((p) => {
        const isActive = p.key === active;
        const activeFg =
          p.tone === "buy" ? colors.buy
          : p.tone === "sell" ? colors.sell
          : p.tone === "primary" ? colors.primary
          : colors.text;
        const activeBg =
          p.tone === "buy" ? colors.buyDim
          : p.tone === "sell" ? colors.sellDim
          : p.tone === "primary" ? colors.primaryDim
          : colors.bgSurface;
        return (
          <Pressable key={p.key} onPress={() => onChange(p.key)}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: isActive ? activeBg : colors.bgElevated,
                borderWidth: 1,
                borderColor: isActive ? activeFg : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 0.4,
                  color: isActive ? activeFg : colors.textMuted,
                }}
              >
                {p.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function EmptyHint({
  icon,
  title,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
}) {
  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: colors.border,
        borderRadius: radii.lg,
        paddingVertical: spacing.xl,
        alignItems: "center",
      }}
    >
      <Ionicons name={icon} size={26} color={colors.textMuted} />
      <Text style={{ fontWeight: "600", marginTop: 6 }}>{title}</Text>
      {hint ? (
        <Text tone="muted" size="xs" style={{ textAlign: "center", marginTop: 4 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Wraps PositionRowV2 with a per-tick live P/L recompute. The cached
 * `row.pnl` comes from the server (`unrealized_pnl` refreshed every
 * 3-5 s by the positions poll), which is why a freshly-placed trade
 * used to show "₹0.00" for the first 2-3 s — the server hadn't run
 * its first refresh yet. Subscribing to the in-memory WS ticker store
 * lets us recompute (ltp − entry) × qty on every tick so the row's
 * P/L starts ticking the moment the next price arrives — typically
 * within ~100-300 ms of the order being placed.
 *
 * Closed rows skip the recompute (their realised P&L is final and
 * lives on `realized_pnl`, not `unrealized_pnl`).
 *
 * Heuristic for picking between live-derived and server-reported:
 * prefer whichever has the larger magnitude. This:
 *   • Lets live derivation drive the value for INR-quoted positions
 *     (NIFTY, BTCINR mock, etc.) — server lags, derived is fresh.
 *   • Falls back to the server's value for USD-quoted positions
 *     (BTCUSD, EURUSD, XAUUSD) once it lands — server applies FX so
 *     its INR magnitude blows past the client-side native-currency
 *     number and "max-abs" naturally picks it.
 *
 * Mirrors the same pattern the web `<PositionRow>` already uses
 * (frontend-user/components/trading/PositionsTabs.tsx).
 */
function LivePositionRow({
  row,
  onPress,
  onClose,
  onEditSlTp,
  closing,
}: {
  row: PositionRowData;
  onPress?: () => void;
  onClose?: () => void;
  onEditSlTp?: () => void;
  closing?: boolean;
}) {
  const tick = useTickerStore((s) =>
    row.instrument_token ? s.ticks[row.instrument_token] : undefined,
  );

  const liveRow = useMemo(() => {
    if (row.status !== "OPEN") return row;
    const liveLtp = tick?.ltp;
    if (liveLtp == null || !Number.isFinite(liveLtp)) return row;
    const avg = Number(row.entry_price);
    const qty = Number(row.quantity);
    if (!Number.isFinite(avg) || avg <= 0 || !Number.isFinite(qty) || qty <= 0) {
      return { ...row, ltp: liveLtp };
    }
    const isBuy = row.side === "BUY";
    const derivedPnl = (isBuy ? liveLtp - avg : avg - liveLtp) * qty;
    const serverPnl = Number(row.pnl) || 0;
    const displayPnl =
      Math.abs(derivedPnl) >= Math.abs(serverPnl) ? derivedPnl : serverPnl;
    return { ...row, ltp: liveLtp, pnl: displayPnl };
  }, [row, tick?.ltp]);

  return (
    <PositionRowV2
      row={liveRow}
      onPress={onPress}
      onClose={onClose}
      onEditSlTp={onEditSlTp}
      closing={closing}
    />
  );
}
