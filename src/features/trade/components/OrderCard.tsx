import { memo } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { fmtIST } from "@shared/utils/time";
import { formatNumber } from "@shared/utils/format";
import type { Order, OrderStatus } from "@features/trade/types/order.types";

interface Props {
  order: Order;
  onPress?: () => void;
  onCancel?: () => void;
}

const STATUS_COLOR: Record<OrderStatus, { fg: string; bg: string; label: string }> = {
  EXECUTED: { fg: colors.buy, bg: "rgba(45,212,191,0.14)", label: "EXECUTED" },
  OPEN: { fg: colors.info, bg: "rgba(96,165,250,0.15)", label: "OPEN" },
  PENDING: { fg: colors.info, bg: "rgba(96,165,250,0.15)", label: "PENDING" },
  PARTIALLY_FILLED: { fg: colors.warn, bg: "rgba(245,158,11,0.16)", label: "PARTIAL" },
  CANCELLED: { fg: colors.textMuted, bg: "rgba(113,113,122,0.18)", label: "CANCELLED" },
  REJECTED: { fg: colors.sell, bg: "rgba(251,113,133,0.14)", label: "REJECTED" },
};

function StatusPill({ status }: { status: OrderStatus }) {
  const s = STATUS_COLOR[status];
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: s.bg,
      }}
    >
      <Text
        size="xs"
        style={{ color: s.fg, fontWeight: "700", letterSpacing: 0.4 }}
      >
        {s.label}
      </Text>
    </View>
  );
}

function OrderCardImpl({ order, onPress, onCancel }: Props) {
  const isBuy = order.action === "BUY";
  const canCancel =
    onCancel && (order.status === "OPEN" || order.status === "PENDING");
  const filled = Number(order.filled_quantity ?? 0);
  const qty = Number(order.quantity ?? 0);
  const priceLabel = formatPriceLabel(order);
  const timeIso = order.executed_at || order.cancelled_at || order.created_at;

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          backgroundColor: colors.bgElevated,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.md,
        }}
      >
        {/* Header: symbol + status pill */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View
              style={{
                width: 3,
                height: 28,
                borderRadius: 2,
                backgroundColor: isBuy ? colors.buy : colors.sell,
                marginRight: 10,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
                {order.symbol}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 4,
                    backgroundColor: isBuy ? "rgba(45,212,191,0.14)" : "rgba(251,113,133,0.14)",
                    marginRight: 6,
                  }}
                >
                  <Text
                    size="xs"
                    style={{
                      color: isBuy ? colors.buy : colors.sell,
                      fontWeight: "700",
                      letterSpacing: 0.4,
                    }}
                  >
                    {isBuy ? "BUY" : "SELL"}
                  </Text>
                </View>
                <Text tone="dim" size="xs">
                  {order.exchange ?? ""} · {order.product_type} · {order.order_type}
                </Text>
              </View>
            </View>
          </View>
          <StatusPill status={order.status} />
        </View>

        {/* Qty + Price */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 14,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View>
            <Text tone="dim" size="xs">
              Qty (filled / total)
            </Text>
            <Text mono style={{ fontSize: 14, fontWeight: "600", marginTop: 2 }}>
              {filled} / {qty}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text tone="dim" size="xs">
              {priceLabel.label}
            </Text>
            <Text mono style={{ fontSize: 14, fontWeight: "600", marginTop: 2 }}>
              {priceLabel.value}
            </Text>
          </View>
        </View>

        {/* Footer: time + cancel/rejection */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 10,
          }}
        >
          <Text tone="muted" size="xs">
            {timeIso ? fmtIST(timeIso, "dd MMM · hh:mm a") : ""}
          </Text>
          {canCancel ? (
            <Pressable onPress={onCancel} hitSlop={8}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: colors.sellDim,
                }}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={14}
                  color={colors.sell}
                  style={{ marginRight: 4 }}
                />
                <Text style={{ color: colors.sell, fontSize: 12, fontWeight: "700" }}>
                  Cancel
                </Text>
              </View>
            </Pressable>
          ) : order.status === "REJECTED" && order.rejection_reason ? (
            <Text
              tone="sell"
              size="xs"
              numberOfLines={1}
              style={{ flex: 1, textAlign: "right", marginLeft: 8 }}
            >
              {order.rejection_reason}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function formatPriceLabel(o: Order): { label: string; value: string } {
  const avg = Number(o.average_price ?? 0);
  if (o.status === "EXECUTED" || o.status === "PARTIALLY_FILLED" || avg > 0) {
    return { label: "Avg price", value: formatNumber(avg, 2) };
  }
  if (o.order_type === "MARKET") {
    return { label: "Order type", value: "MARKET" };
  }
  return { label: "Limit price", value: formatNumber(o.price ?? 0, 2) };
}

export const OrderCard = memo(OrderCardImpl);
