import { memo } from "react";
import { View } from "react-native";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { formatNumber, formatSigned } from "@shared/utils/format";
import { useTicker } from "@features/trade/hooks/useTicker";

interface Props {
  token: string;
  symbol: string;
  interval: string; // "5m" / "1m" / etc — display label, not the API value
  segment?: string; // CRYPTO / FOREX / NSE / MCX — shown next to the symbol
  source?: string; // INFOWAY / ZERODHA — tag at the right, matches web header
}

// Live OHLC + change + volume bar that mirrors the web frontend's chart
// header. Every field reads from the ticker store via `useTicker`, so the
// values tick in real time alongside the candles. The web version sits
// above the chart and shows everything at a glance — that's the
// "BTCUSD · 5m · CRYPTO  O ... H ... L ... C ... -72.30 (-0.09%)" strip
// the user was missing on mobile.
function ChartInfoBarImpl({ token, symbol, interval, segment, source }: Props) {
  const tick = useTicker(token);

  const ltp = tick?.ltp ?? null;
  const open = tick?.open ?? null;
  const high = tick?.high ?? null;
  const low = tick?.low ?? null;
  const close = tick?.close ?? null;
  const change = tick?.change ?? null;
  const changePct = tick?.change_pct ?? null;
  const volume = tick?.volume ?? null;

  const tone =
    change == null || change === 0
      ? colors.textMuted
      : change > 0
        ? colors.buy
        : colors.sell;

  const fmt = (v: number | null | undefined) =>
    v == null ? "—" : formatNumber(v, 2);
  const fmtVol = (v: number | null | undefined) => {
    if (v == null) return "—";
    // Full Indian-grouped number (52,34,567) — user-requested removal
    // of K/M/L/Cr abbreviations across the whole product.
    return Number(v).toLocaleString("en-IN");
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
        backgroundColor: colors.bg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {/* Symbol · interval · segment header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ fontWeight: "700", fontSize: 13 }}>{symbol}</Text>
        <Text tone="dim" size="xs">
          ·
        </Text>
        <Text tone="muted" size="xs" style={{ fontWeight: "600" }}>
          {interval}
        </Text>
        {segment ? (
          <>
            <Text tone="dim" size="xs">
              ·
            </Text>
            <Text tone="muted" size="xs" style={{ fontWeight: "600" }}>
              {segment}
            </Text>
          </>
        ) : null}
      </View>

      {/* OHLC strip — each pair is a tiny label + mono value, same layout
          as TradingView's top-left status line. Mono font keeps the
          numbers aligned even as the digits tick up/down. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <OhlcPair label="O" value={fmt(open)} tone={tone} />
        <OhlcPair label="H" value={fmt(high)} tone={colors.buy} />
        <OhlcPair label="L" value={fmt(low)} tone={colors.sell} />
        <OhlcPair label="C" value={fmt(close ?? ltp)} tone={tone} />
      </View>

      {/* Change pill — coloured by direction (green up / red down).
          Shows absolute + percent change so the user reads both deltas. */}
      {change != null || changePct != null ? (
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor:
              change != null && change >= 0
                ? "rgba(34,197,94,0.12)"
                : "rgba(239,68,68,0.12)",
          }}
        >
          <Text
            mono
            size="xs"
            style={{ color: tone, fontWeight: "700" }}
          >
            {change != null ? formatSigned(change) : ""}
            {changePct != null
              ? ` (${formatSigned(changePct)}%)`
              : ""}
          </Text>
        </View>
      ) : null}

      {/* Volume + feed source — pushed to the right when there's room. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginLeft: "auto",
        }}
      >
        {volume != null ? (
          <>
            <Text tone="muted" size="xs">
              Vol
            </Text>
            <Text mono size="xs" style={{ fontWeight: "700" }}>
              {fmtVol(volume)}
            </Text>
          </>
        ) : null}
        {source ? (
          <View
            style={{
              marginLeft: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              backgroundColor: colors.bgElevated,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              size="xs"
              style={{
                color: colors.textMuted,
                fontWeight: "700",
                letterSpacing: 0.6,
                fontSize: 9,
              }}
            >
              {source}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function OhlcPair({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
      <Text tone="dim" size="xs" style={{ fontWeight: "700" }}>
        {label}
      </Text>
      <Text mono size="xs" style={{ color: tone, fontWeight: "700" }}>
        {value}
      </Text>
    </View>
  );
}

export const ChartInfoBar = memo(ChartInfoBarImpl);
