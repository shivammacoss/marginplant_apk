import { memo, useMemo } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { formatINR, formatNumber, formatSigned } from "@shared/utils/format";
import { useTickers } from "@features/trade/hooks/useTickers";

interface OverviewRow {
  token: string;
  symbol: string;
  name: string;
  exchange: "NSE" | "BSE" | "NFO";
  icon: keyof typeof Ionicons.glyphMap;
  iconTint: string;
  iconBg: string;
}

// Hand-picked watchlist for the home page. Tokens map to Zerodha's instrument
// IDs — same source as the rest of the app. Quotes flow through the existing
// marketdata WS (Zerodha for NSE/NFO, Infoway for forex/crypto/metals), so
// nothing renders as a number until a real tick arrives — "—" by design.
const ROWS: OverviewRow[] = [
  {
    token: "256265",
    symbol: "NIFTY",
    name: "Nifty 50",
    exchange: "NSE",
    icon: "trending-up",
    iconTint: "#10B981",
    iconBg: "rgba(16,185,129,0.14)",
  },
  {
    token: "260105",
    symbol: "BANKNIFTY",
    name: "Bank Nifty",
    exchange: "NSE",
    icon: "business-outline",
    iconTint: "#60A5FA",
    iconBg: "rgba(96,165,250,0.14)",
  },
  {
    token: "257801",
    symbol: "FINNIFTY",
    name: "Fin Nifty",
    exchange: "NSE",
    icon: "cash-outline",
    iconTint: "#34D399",
    iconBg: "rgba(52,211,153,0.14)",
  },
  {
    token: "265",
    symbol: "SENSEX",
    name: "BSE Sensex",
    exchange: "BSE",
    icon: "bar-chart-outline",
    iconTint: "#A855F7",
    iconBg: "rgba(168,85,247,0.18)",
  },
  {
    token: "738561",
    symbol: "RELIANCE",
    name: "Reliance Inds.",
    exchange: "NSE",
    icon: "flash-outline",
    iconTint: "#22D3EE",
    iconBg: "rgba(34,211,238,0.14)",
  },
  {
    token: "2953217",
    symbol: "TCS",
    name: "Tata Consultancy",
    exchange: "NSE",
    icon: "laptop-outline",
    iconTint: "#60A5FA",
    iconBg: "rgba(96,165,250,0.14)",
  },
  {
    token: "341249",
    symbol: "HDFCBANK",
    name: "HDFC Bank",
    exchange: "NSE",
    icon: "card-outline",
    iconTint: "#94A3B8",
    iconBg: "rgba(148,163,184,0.16)",
  },
  {
    token: "1270529",
    symbol: "ICICIBANK",
    name: "ICICI Bank",
    exchange: "NSE",
    icon: "wallet-outline",
    iconTint: "#F97316",
    iconBg: "rgba(249,115,22,0.16)",
  },
  {
    token: "408065",
    symbol: "INFY",
    name: "Infosys",
    exchange: "NSE",
    icon: "globe-outline",
    iconTint: "#22D3EE",
    iconBg: "rgba(34,211,238,0.14)",
  },
];

function ChangePill({ changePct }: { changePct: number | undefined }) {
  const hasData = changePct != null;
  const up = (changePct ?? 0) >= 0;
  const tint = !hasData ? colors.textDim : up ? colors.buy : colors.sell;
  const bg = !hasData
    ? "rgba(113,113,122,0.14)"
    : up
    ? "rgba(45,212,191,0.14)"
    : "rgba(251,113,133,0.14)";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: bg,
        marginTop: 4,
      }}
    >
      {hasData ? (
        <Ionicons
          name={up ? "caret-up" : "caret-down"}
          size={10}
          color={tint}
          style={{ marginRight: 3 }}
        />
      ) : null}
      <Text size="xs" style={{ color: tint, fontWeight: "700" }}>
        {hasData ? `${formatSigned(changePct as number)}%` : "—"}
      </Text>
    </View>
  );
}

function MarketRow({
  row,
  ltp,
  changePct,
  showDivider,
}: {
  row: OverviewRow;
  ltp?: number;
  changePct?: number;
  showDivider?: boolean;
}) {
  return (
    <Pressable onPress={() => router.push({ pathname: "/(tabs)/trade", params: { token: row.token } })}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          borderBottomWidth: showDivider ? 1 : 0,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: row.iconBg,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name={row.icon} size={18} color={row.iconTint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "700" }} numberOfLines={1}>
            {row.symbol}
          </Text>
          <Text tone="muted" size="xs" style={{ marginTop: 2 }} numberOfLines={1}>
            {row.name}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 15, fontWeight: "700" }}>
            {ltp != null ? formatINR(ltp) : "—"}
          </Text>
          <ChangePill changePct={changePct} />
        </View>
      </View>
    </Pressable>
  );
}

interface Props {
  feedConnected?: boolean;
}

function MarketOverviewImpl({ feedConnected = true }: Props) {
  const tokens = useMemo(() => ROWS.map((r) => r.token), []);
  const ticks = useTickers(tokens);

  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: 4,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <Text size="xs" style={{ fontWeight: "700", letterSpacing: 0.8, color: colors.text }}>
          MARKET OVERVIEW
        </Text>
        <Text tone="dim" size="xs" style={{ fontWeight: "600", letterSpacing: 0.5 }}>
          NSE · BSE
        </Text>
      </View>
      {!feedConnected ? (
        <Text tone="muted" size="xs" style={{ marginTop: 6 }}>
          Waiting for live feed. Quotes will appear here when Zerodha / Infoway connects.
        </Text>
      ) : null}
      {ROWS.map((r, i) => {
        const t = ticks[r.token];
        return (
          <MarketRow
            key={r.token}
            row={r}
            ltp={t?.ltp}
            changePct={t?.change_pct}
            showDivider={i < ROWS.length - 1}
          />
        );
      })}
    </View>
  );
}

export const MarketOverview = memo(MarketOverviewImpl);
