import { memo } from "react";
import { ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { formatINR } from "@shared/utils/format";
import type { PnLSummary } from "@features/portfolio/types/position.types";

interface Props {
  data?: PnLSummary;
  loading?: boolean;
}

function pnlTone(v: number): "buy" | "sell" | "muted" {
  if (v > 0) return "buy";
  if (v < 0) return "sell";
  return "muted";
}

function PnLSummaryCardsImpl({ data, loading }: Props) {
  const today = Number(data?.today_pnl ?? 0);
  const week = Number(data?.week_pnl ?? 0);
  const lastWeek = Number(data?.last_week_pnl ?? 0);
  const todayRealised = Number(data?.today_realised ?? 0);
  const openUnrealised = Number(data?.open_unrealised ?? 0);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 2 }}
    >
      <PnLCard
        label="Today"
        value={today}
        hint={`R ${formatINR(todayRealised)} · U ${formatINR(openUnrealised)}`}
        icon={today >= 0 ? "trending-up" : "trending-down"}
        loading={loading}
      />
      <PnLCard
        label="This Week"
        value={week}
        hint="Sun → today"
        icon={week >= 0 ? "trending-up" : "trending-down"}
        loading={loading}
        marginLeft
      />
      <PnLCard
        label="Last Week"
        value={lastWeek}
        hint="Realised · Sun → Sat"
        icon="calendar-outline"
        loading={loading}
        marginLeft
      />
    </ScrollView>
  );
}

interface PnLCardProps {
  label: string;
  value: number;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  marginLeft?: boolean;
}

function PnLCard({ label, value, hint, icon, loading, marginLeft }: PnLCardProps) {
  const tone = pnlTone(value);
  const accent =
    tone === "buy" ? colors.buy : tone === "sell" ? colors.sell : colors.textMuted;
  return (
    <View
      style={{
        width: 170,
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginLeft: marginLeft ? 10 : 0,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text tone="muted" size="xs" style={{ letterSpacing: 0.5, fontWeight: "600" }}>
          {label.toUpperCase()}
        </Text>
        <Ionicons name={icon} size={14} color={accent} />
      </View>
      <Text
        mono
        style={{ fontSize: 18, fontWeight: "700", color: accent, marginTop: 6 }}
        numberOfLines={1}
      >
        {loading ? "—" : formatINR(value)}
      </Text>
      {hint ? (
        <Text tone="dim" size="xs" style={{ marginTop: 4 }} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export const PnLSummaryCards = memo(PnLSummaryCardsImpl);
