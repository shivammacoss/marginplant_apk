import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { IllustrationEmpty } from "@shared/components/IllustrationEmpty";
import { SketchIllustration } from "@shared/components/SketchIllustration";
import { Loader } from "@shared/ui/Loader";
import { Text } from "@shared/ui/Text";
import { colors, spacing } from "@shared/theme";
import { useCancelOrder, useOrders } from "@features/trade/hooks/useOrders";
import { formatNumber } from "@shared/utils/format";
import { useManualRefresh } from "@shared/hooks/useManualRefresh";
import type { Order, OrderStatus } from "@features/trade/types/order.types";

type TabKey = "open" | "executed" | "rejected";

// All / Buy / Sell / SL·TP — same chip strip we render on the Portfolio
// screen so users get a consistent affordance across both blotters. The
// "sltp" filter shows only orders that have a bracket leg attached
// (bracket_stop_loss or bracket_target non-null on the order record).
type SideFilter = "all" | "buy" | "sell" | "sltp";

function orderHasBracket(o: Order): boolean {
  const sl = o.bracket_stop_loss;
  const tp = o.bracket_target;
  return (
    (sl != null && sl !== "" && Number(sl) > 0) ||
    (tp != null && tp !== "" && Number(tp) > 0)
  );
}

function matchesOrderFilter(o: Order, f: SideFilter): boolean {
  if (f === "all") return true;
  if (f === "buy") return o.action === "BUY";
  if (f === "sell") return o.action === "SELL";
  return orderHasBracket(o);
}

const OPEN_STATUSES: OrderStatus[] = ["OPEN", "PENDING", "PARTIALLY_FILLED"];
const EXECUTED_STATUSES: OrderStatus[] = ["EXECUTED"];
const REJECTED_STATUSES: OrderStatus[] = ["REJECTED", "CANCELLED"];

function statusAllowedFor(tab: TabKey): OrderStatus[] {
  if (tab === "open") return OPEN_STATUSES;
  if (tab === "executed") return EXECUTED_STATUSES;
  return REJECTED_STATUSES;
}

function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Compact "14 May" — full date is overkill on a mobile row, year is
  // implied by the calendar context. If the order is from a previous
  // year we add the year back so old history rows stay unambiguous.
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function fmtSegmentLabel(segment?: string, exchange?: string): string {
  if (!segment && !exchange) return "";
  const s = (segment ?? "").toUpperCase();
  if (s.includes("CRYPTO")) return "Crypto";
  if (s.includes("CDS") || s.includes("FOREX")) return "Forex";
  if (s.includes("MCX") || s.includes("COMEX")) return "Comex";
  if (s.includes("NFO") || s.includes("BFO")) return "F&O";
  if (s.includes("BSE")) return "BSE";
  if (s.includes("NSE")) return "NSE";
  return exchange ?? "";
}

export function OrdersScreen() {
  const [tab, setTab] = useState<TabKey>("open");
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const { data, isLoading, isError, error, refetch } = useOrders({
    limit: 200,
  });
  const cancel = useCancelOrder();

  // Manual-pull spinner only. Shared hook (see useManualRefresh).
  const { refreshing: manualRefreshing, onRefresh: onManualRefresh } =
    useManualRefresh(async () => {
      await refetch();
    });

  const allOrders = data ?? [];

  const counts = useMemo(() => {
    return {
      open: allOrders.filter((o) => OPEN_STATUSES.includes(o.status)).length,
      executed: allOrders.filter((o) => EXECUTED_STATUSES.includes(o.status)).length,
      rejected: allOrders.filter((o) => REJECTED_STATUSES.includes(o.status)).length,
    };
  }, [allOrders]);

  const rows = useMemo(() => {
    const allow = statusAllowedFor(tab);
    const tabFiltered = allOrders.filter((o) => allow.includes(o.status));
    if (sideFilter === "all") return tabFiltered;
    return tabFiltered.filter((o) => matchesOrderFilter(o, sideFilter));
  }, [allOrders, tab, sideFilter]);

  function confirmCancel(o: Order) {
    Alert.alert(
      "Cancel order?",
      `${o.action} ${o.lots} ${o.symbol} will be cancelled.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel order",
          style: "destructive",
          onPress: () => cancel.mutate(o.id),
        },
      ],
    );
  }

  return (
    <Screen padded={false}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
        }}
      >
        <Text style={{ fontSize: 26, fontWeight: "800" }}>Orders</Text>
      </View>

      <>
          {/* Tabs row */}
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <TabPill
              label="Open"
              count={counts.open}
              active={tab === "open"}
              onPress={() => setTab("open")}
            />
            <TabPill
              label="Executed"
              count={counts.executed}
              active={tab === "executed"}
              onPress={() => setTab("executed")}
            />
            <TabPill
              label="Rejected"
              count={counts.rejected}
              active={tab === "rejected"}
              onPress={() => setTab("rejected")}
            />
          </View>

          {/* Quick filter — All / Buy / Sell / SL·TP. Same chip strip as
              Portfolio so the user sees the affordance in both places. */}
          <SideFilterChips active={sideFilter} onChange={setSideFilter} />

          {/* List */}
          {isLoading ? (
            <Loader label="Loading orders…" fullscreen />
          ) : isError ? (
            <IllustrationEmpty
              illustration={<SketchIllustration kind="clipboard" />}
              title="Couldn't load orders"
              description={(error as Error)?.message ?? "Please try again."}
            />
          ) : rows.length === 0 ? (
            <IllustrationEmpty
              illustration={<SketchIllustration kind="clipboard" />}
              title={`No ${tab} orders`}
              description={
                tab === "open"
                  ? "Pending and partially filled orders will appear here."
                  : tab === "executed"
                  ? "Filled orders will appear here once you trade."
                  : "Rejected and cancelled orders will show up here."
              }
            />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(o) => o.id}
              contentContainerStyle={{
                paddingTop: spacing.sm,
                paddingBottom: spacing.xl,
              }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  tintColor={colors.textMuted}
                  refreshing={manualRefreshing}
                  onRefresh={onManualRefresh}
                />
              }
              ItemSeparatorComponent={() => (
                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.border,
                    marginHorizontal: spacing.lg,
                  }}
                />
              )}
              renderItem={({ item }) => (
                <OrderRow
                  order={item}
                  onLongPress={
                    OPEN_STATUSES.includes(item.status)
                      ? () => confirmCancel(item)
                      : undefined
                  }
                />
              )}
            />
          )}
        </>
    </Screen>
  );
}

// 4-pill horizontal strip — All / Buy / Sell / SL·TP. Identical look
// to the same component on PortfolioScreen so the user gets a
// consistent affordance across both blotters.
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
        paddingTop: spacing.sm,
        paddingBottom: 4,
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

function TabPill({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ marginRight: 24 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 12,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: active ? "700" : "600",
            color: active ? colors.text : colors.textMuted,
          }}
        >
          {label}
        </Text>
        <View
          style={{
            marginLeft: 8,
            minWidth: 22,
            paddingHorizontal: 6,
            height: 18,
            borderRadius: 999,
            backgroundColor: colors.bgSurface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            size="xs"
            style={{
              color: colors.textMuted,
              fontWeight: "700",
            }}
          >
            {count}
          </Text>
        </View>
      </View>
      {active ? (
        <View
          style={{
            height: 2,
            backgroundColor: colors.primary,
            borderRadius: 1,
            marginTop: -2,
          }}
        />
      ) : null}
    </Pressable>
  );
}

function SidePill({ side }: { side: "BUY" | "SELL" }) {
  const isBuy = side === "BUY";
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        backgroundColor: isBuy ? "rgba(168,85,247,0.18)" : "rgba(251,113,133,0.16)",
      }}
    >
      <Text
        size="xs"
        style={{
          color: isBuy ? colors.primary : colors.sell,
          fontWeight: "800",
          letterSpacing: 0.6,
        }}
      >
        {side}
      </Text>
    </View>
  );
}

const STATUS_STYLE: Record<
  OrderStatus,
  { fg: string; bg: string; label: string }
> = {
  EXECUTED: { fg: colors.primary, bg: "rgba(168,85,247,0.18)", label: "EXECUTED" },
  OPEN: { fg: colors.warn, bg: "rgba(245,158,11,0.16)", label: "OPEN" },
  PENDING: { fg: colors.warn, bg: "rgba(245,158,11,0.16)", label: "PENDING" },
  PARTIALLY_FILLED: { fg: colors.warn, bg: "rgba(245,158,11,0.16)", label: "PARTIAL" },
  CANCELLED: { fg: colors.textMuted, bg: "rgba(113,113,122,0.18)", label: "CANCELLED" },
  REJECTED: { fg: colors.sell, bg: "rgba(251,113,133,0.14)", label: "REJECTED" },
};

function StatusPill({ status }: { status: OrderStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        backgroundColor: s.bg,
      }}
    >
      <Text size="xs" style={{ color: s.fg, fontWeight: "800", letterSpacing: 0.5 }}>
        {s.label}
      </Text>
    </View>
  );
}

function OrderRow({
  order,
  onLongPress,
}: {
  order: Order;
  onLongPress?: () => void;
}) {
  const segmentLabel = fmtSegmentLabel(order.segment, order.exchange);
  const eventTs = order.executed_at || order.cancelled_at || order.created_at;
  const time = fmtTime(eventTs);
  const date = fmtDate(eventTs);

  // Price display: average price for filled, limit price for open, "—" otherwise
  const avg = Number(order.average_price ?? 0);
  const limit = Number(order.price ?? 0);
  const priceValue =
    avg > 0
      ? formatNumber(avg, 2)
      : order.order_type === "MARKET"
      ? "MARKET"
      : limit > 0
      ? formatNumber(limit, 2)
      : "—";

  // Quantity in the cart chip — filled qty for executed, else order qty
  const cartQty =
    order.status === "EXECUTED" && order.filled_quantity > 0
      ? order.filled_quantity
      : order.quantity;

  return (
    <Pressable onLongPress={onLongPress} delayLongPress={400}>
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: 12 }}>
        {/* Top row: side + cart qty | time + status */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <SidePill side={order.action} />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginLeft: 10,
              }}
            >
              <Ionicons name="cart-outline" size={14} color={colors.text} />
              <Text style={{ marginLeft: 4, fontSize: 13, fontWeight: "700" }}>
                {cartQty}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <View style={{ marginLeft: 4, marginRight: 10, alignItems: "flex-end" }}>
              <Text tone="muted" size="xs" style={{ fontWeight: "600" }}>
                {time}
              </Text>
              {date ? (
                <Text tone="dim" style={{ fontSize: 10, marginTop: 1 }}>
                  {date}
                </Text>
              ) : null}
            </View>
            <StatusPill status={order.status} />
          </View>
        </View>

        {/* Bottom row: symbol + segment | price + product type */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "800" }} numberOfLines={1}>
              {order.symbol}
            </Text>
            {segmentLabel ? (
              <Text tone="dim" size="xs" style={{ marginTop: 2 }}>
                {segmentLabel}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text mono style={{ fontSize: 16, fontWeight: "800" }}>
              {priceValue}
            </Text>
            <Text tone="dim" size="xs" style={{ marginTop: 2 }}>
              {order.product_type}
            </Text>
          </View>
        </View>

        {order.status === "REJECTED" && order.rejection_reason ? (
          <Text tone="sell" size="xs" style={{ marginTop: 6 }} numberOfLines={2}>
            {order.rejection_reason}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
