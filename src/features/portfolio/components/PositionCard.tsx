import { memo } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radii } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { formatINR, formatNumber } from "@shared/utils/format";
import type { Position } from "@features/portfolio/types/position.types";

interface Props {
  position: Position;
  onPress?: () => void;
  onClose?: () => void;
  closing?: boolean;
}

function PositionCardImpl({ position, onPress, onClose, closing }: Props) {
  const qty = Number(position.quantity ?? 0);
  const isLong = qty > 0;
  const absQty = Math.abs(qty);
  const lots = Number(position.lots ?? 0);
  const avg = Number(position.avg_price ?? 0);
  const ltp = Number(position.ltp ?? 0);
  const unrealised = Number(position.unrealized_pnl ?? 0);
  const realised = Number(position.realized_pnl ?? 0);
  const pnl = unrealised + realised;
  const tone = pnl > 0 ? colors.buy : pnl < 0 ? colors.sell : colors.textMuted;
  const isUsd = position.currency_quote === "USD";
  const ltpFmt = isUsd ? `$${formatNumber(ltp, 4)}` : formatNumber(ltp, 2);
  const avgFmt = isUsd ? `$${formatNumber(avg, 4)}` : formatNumber(avg, 2);
  const open = position.status === "OPEN";
  const qtyDisplay = lots && !Number.isInteger(lots) ? lots.toFixed(2) : String(absQty);

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          backgroundColor: colors.bgElevated,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 10,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <View
          style={{
            width: 3,
            alignSelf: "stretch",
            borderRadius: 2,
            backgroundColor: isLong ? colors.buy : colors.sell,
          }}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
              {position.symbol}
            </Text>
            <Text
              size="xs"
              style={{
                color: isLong ? colors.buy : colors.sell,
                fontWeight: "700",
                letterSpacing: 0.4,
              }}
            >
              {isLong ? "LONG" : "SHORT"}
            </Text>
          </View>
          <Text tone="dim" size="xs" style={{ marginTop: 2 }} numberOfLines={1}>
            Qty {qtyDisplay} · Avg {avgFmt} · LTP {ltpFmt}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text mono style={{ fontSize: 14, fontWeight: "700", color: tone }}>
            {pnl >= 0 ? "+" : ""}
            {formatINR(pnl)}
          </Text>
          <Text tone="dim" size="xs" style={{ marginTop: 2 }}>
            P&L
          </Text>
        </View>
        {open && onClose ? (
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onClose();
            }}
            disabled={closing}
            hitSlop={8}
          >
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: colors.sellDim,
                alignItems: "center",
                justifyContent: "center",
                opacity: closing ? 0.5 : 1,
              }}
            >
              <Ionicons name={closing ? "hourglass-outline" : "close"} size={16} color={colors.sell} />
            </View>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export const PositionCard = memo(PositionCardImpl);
