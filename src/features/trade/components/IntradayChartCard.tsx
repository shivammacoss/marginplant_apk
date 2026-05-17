import { memo, useMemo, useState } from "react";
import { Dimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { Chip } from "@shared/ui/Chip";
import { IntradayLineChart } from "@features/charts/components/IntradayLineChart";
import { formatSigned } from "@shared/utils/format";

const FILTERS = ["Price", "OI", "Change in OI", "ATM Straddle"] as const;
type Filter = (typeof FILTERS)[number];

interface Props {
  symbol: string;
  changePct: number;
  data: number[];
  startTs?: number;
  endTs?: number;
}

// Detect short-term trend from the last ~10 points. "Strong" if the
// slope's magnitude exceeds the median tick step by 3×.
function detectTrend(data: number[]): {
  kind: "up" | "down" | "flat";
  strong: boolean;
  sinceIdx: number;
} {
  if (data.length < 4) return { kind: "flat", strong: false, sinceIdx: 0 };
  const tail = data.slice(-Math.min(12, data.length));
  const first = tail[0]!;
  const last = tail[tail.length - 1]!;
  const delta = last - first;
  const stepMag = Math.abs(first) * 0.001 || 0.01;
  if (Math.abs(delta) < stepMag) return { kind: "flat", strong: false, sinceIdx: 0 };
  const kind = delta > 0 ? "up" : "down";
  const strong = Math.abs(delta) > stepMag * 3;
  return { kind, strong, sinceIdx: data.length - tail.length };
}

function IntradayChartCardImpl({
  symbol,
  changePct,
  data,
  startTs,
  endTs,
}: Props) {
  const [active, setActive] = useState<Filter>("Price");
  const isDown = changePct < 0;
  const tone = isDown ? colors.sell : colors.buy;
  const width = Dimensions.get("window").width - 32;

  const trend = useMemo(() => detectTrend(data), [data]);
  const trendLabel = trend.strong
    ? trend.kind === "up"
      ? "Strong Uptrend"
      : "Strong Downtrend"
    : trend.kind === "up"
    ? "Uptrend"
    : trend.kind === "down"
    ? "Downtrend"
    : "Range-bound";
  const trendColor =
    trend.kind === "up"
      ? colors.buy
      : trend.kind === "down"
      ? colors.sell
      : colors.textMuted;
  // "Since 02:50 PM" derived from the start-of-trend tick timestamp.
  const sinceTs = useMemo(() => {
    if (!startTs || !endTs || data.length < 2) return null;
    const span = endTs - startTs;
    const t = startTs + (span * trend.sinceIdx) / (data.length - 1);
    return new Date(t).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, [startTs, endTs, data.length, trend.sinceIdx]);

  return (
    <View
      style={{
        gap: 14,
        backgroundColor: colors.bgElevated,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>{symbol}</Text>
            <Text style={{ color: tone, fontWeight: "600", fontSize: 14 }}>
              {formatSigned(changePct)}%
            </Text>
            <Ionicons
              name={isDown ? "caret-down" : "caret-up"}
              size={12}
              color={tone}
            />
          </View>
          <Text tone="muted" size="sm" style={{ marginTop: 2 }}>
            Day's analysis
          </Text>
        </View>
        {trend.kind !== "flat" ? (
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: trendColor,
              paddingHorizontal: 10,
              paddingVertical: 6,
              alignItems: "flex-end",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons
                name={
                  trend.kind === "up" ? "trending-up" : "trending-down"
                }
                size={12}
                color={trendColor}
              />
              <Text
                size="xs"
                style={{ color: trendColor, fontWeight: "700" }}
              >
                {trendLabel}
              </Text>
            </View>
            {sinceTs ? (
              <Text tone="muted" size="xs" style={{ marginTop: 2 }}>
                Since {sinceTs}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={f}
            size="sm"
            active={f === active}
            onPress={() => setActive(f)}
          />
        ))}
      </View>

      <View style={{ marginTop: 4 }}>
        {data.length >= 2 ? (
          <IntradayLineChart
            data={data}
            width={width - 28}
            height={200}
            startTs={startTs}
            endTs={endTs}
            color={tone}
          />
        ) : (
          <View
            style={{
              height: 200,
              width: width - 28,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text tone="muted">Live chart will appear once feed connects</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export const IntradayChartCard = memo(IntradayChartCardImpl);
