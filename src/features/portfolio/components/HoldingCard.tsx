import { memo } from "react";
import { Pressable, View } from "react-native";
import { colors, radii, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { formatINR, formatNumber, formatPercent } from "@shared/utils/format";
import type { Holding } from "@features/portfolio/types/position.types";

interface Props {
  holding: Holding;
  onPress?: () => void;
}

function HoldingCardImpl({ holding, onPress }: Props) {
  const pnl = Number(holding.pnl ?? 0);
  const pnlPct = Number(holding.pnl_percentage ?? 0);
  const avg = Number(holding.avg_price ?? 0);
  const ltp = Number(holding.ltp ?? 0);
  const cur = Number(holding.current_value ?? 0);
  const tone = pnl > 0 ? colors.buy : pnl < 0 ? colors.sell : colors.textMuted;

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
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
              {holding.symbol}
            </Text>
            <Text tone="dim" size="xs" style={{ marginTop: 2 }}>
              {holding.exchange ?? "NSE"} · {holding.quantity} qty
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text mono style={{ fontSize: 16, fontWeight: "700", color: tone }}>
              {pnl >= 0 ? "+" : ""}
              {formatINR(pnl)}
            </Text>
            <Text mono size="xs" style={{ color: tone, marginTop: 2 }}>
              {pnl >= 0 ? "+" : ""}
              {formatPercent(pnlPct)}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Stat label="Avg" value={formatNumber(avg, 2)} />
          <Stat label="LTP" value={formatNumber(ltp, 2)} />
          <Stat label="Value" value={formatINR(cur)} align="right" />
        </View>
      </View>
    </Pressable>
  );
}

function Stat({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <Text tone="dim" size="xs">
        {label}
      </Text>
      <Text mono style={{ fontSize: 13, fontWeight: "600", marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

export const HoldingCard = memo(HoldingCardImpl);
