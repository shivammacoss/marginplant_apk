import { memo } from "react";
import { View } from "react-native";
import { colors, radii, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { formatINR } from "@shared/utils/format";
import { useLiveWalletKpi } from "@features/portfolio/hooks/useLiveWalletKpi";
import type { WalletSummary } from "@features/wallet/types/wallet.types";
import type { PnLSummary } from "@features/portfolio/types/position.types";

interface Props {
  // Props kept for backwards compatibility with existing call sites, but
  // they are IGNORED. The strip subscribes to its own data via
  // useLiveWalletKpi() so every WS tick repaints M2M, and the optimistic
  // wallet patch from usePlaceOrder.onMutate / close mutations shows up
  // instantly without a server roundtrip.
  wallet?: WalletSummary;
  pnl?: PnLSummary;
}

// LEDGER BALANCE | MARGIN AVAILABLE | MARGIN USED | M2M — the 4-up wallet
// status strip shown above the positions list. Math:
//   Ledger    = available_balance + used_margin   (deposited cash, no PnL)
//   Available = available_balance                  (patched optimistically)
//   Used      = used_margin                        (patched optimistically)
//   M2M       = Σ (live_ltp - avg_price) × signed_qty   ← live tick-driven
function WalletKpiStripImpl(_props: Props) {
  const { ledger, available: avail, used, m2m, cfRequired } = useLiveWalletKpi();

  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row" }}>
        <Kpi label="LEDGER BALANCE" value={formatINR(ledger)} />
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <Kpi label="MARGIN AVAILABLE" value={formatINR(avail)} />
      </View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View style={{ flexDirection: "row" }}>
        <Kpi label="MARGIN USED" value={formatINR(used)} />
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <Kpi
          label="M2M"
          value={formatINR(m2m)}
          tone={m2m > 0 ? "buy" : m2m < 0 ? "sell" : "default"}
        />
      </View>
      {/* CF Required — full-width 5th tile. Surfaces the extra margin a
          user needs to roll all open MIS positions to NRML overnight.
          Computed locally from `margin_used × 0.4` per MIS row, matching
          the backend's `holding_margin` formula on /active-trades. */}
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <Kpi
        label="CF REQUIRED"
        value={formatINR(cfRequired)}
        tone={cfRequired > avail ? "sell" : "default"}
      />
    </View>
  );
}

function Kpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "buy" | "sell";
}) {
  const color =
    tone === "buy" ? colors.buy : tone === "sell" ? colors.sell : colors.text;
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <Text
        tone="dim"
        style={{
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.7,
        }}
      >
        {label}
      </Text>
      <Text
        mono
        style={{
          color,
          fontSize: 17,
          fontWeight: "800",
          marginTop: 4,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

// Total P&L card shown above the positions list — sums P&L across visible rows
// (the screenshot shows "TOTAL P&L  -60576.00"). The value is signed and
// colour-coded.
function TotalPnLCardImpl({ value }: { value: number }) {
  const tone = value > 0 ? colors.buy : value < 0 ? colors.sell : colors.textMuted;
  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        marginBottom: spacing.sm,
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 14,
        alignItems: "center",
        gap: 4,
      }}
    >
      <Text tone="dim" style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>
        TOTAL P&L
      </Text>
      <Text mono style={{ color: tone, fontSize: 22, fontWeight: "800" }}>
        {value >= 0 ? "" : ""}
        {formatINR(value)}
      </Text>
    </View>
  );
}

export const WalletKpiStrip = memo(WalletKpiStripImpl);
export const TotalPnLCard = memo(TotalPnLCardImpl);
