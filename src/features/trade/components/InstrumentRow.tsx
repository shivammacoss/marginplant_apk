import { memo } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { formatNumber, formatSigned } from "@shared/utils/format";
import { useTickerStore } from "@features/trade/store/ticker.store";

interface Props {
  token: string;
  symbol: string;
  name: string;
  exchange: string;
  // Optional REST snapshot fallback — keeps a price visible after market
  // close when WS isn't streaming new ticks. `ltp` is used to seed bid/ask
  // when only one number is available from REST.
  ltp?: number | null;
  bid?: number | null;
  ask?: number | null;
  change?: number | null;
  changePct?: number | null;
  // Star toggles favourite. When undefined the star is hidden.
  starred?: boolean;
  onToggleStar?: () => void;
  // Right-side trailing action: "+" to add to a managed segment list
  // (search results) or "x" to remove from one (curated list).
  trailing?: "add" | "remove" | null;
  onTrailing?: () => void;
  onPress?: () => void;
}

function InstrumentRowImpl({
  token,
  symbol,
  name,
  exchange,
  ltp: ltpFallback,
  bid: bidFallback,
  ask: askFallback,
  change: changeFallback,
  changePct: changePctFallback,
  starred,
  onToggleStar,
  trailing,
  onTrailing,
  onPress,
}: Props) {
  const tick = useTickerStore((s) => s.ticks[token]);

  // Web shows BID (red) on top and ASK (green) below — same convention as
  // every retail trading app (you SELL at the bid, you BUY at the ask).
  // Take live tick values first; fall back to REST snapshot; finally fall
  // back to LTP for instruments where the feed doesn't carry depth.
  const ltp = tick?.ltp ?? ltpFallback ?? null;
  const bid = tick?.bid ?? bidFallback ?? ltp;
  const ask = tick?.ask ?? askFallback ?? ltp;
  const change = tick?.change ?? changeFallback ?? null;
  const changePct = tick?.change_pct ?? changePctFallback ?? null;

  const changeTone =
    change == null || change === 0
      ? colors.textDim
      : change >= 0
        ? colors.buy
        : colors.sell;

  // USD-quoted instruments (BTC/ETH/XAU/forex) show with a "$" prefix on
  // the web — match that on mobile so the row reads identically. Heuristic:
  // names ending USD/USDT/USDC plus exchange tags like CRYPTO/FX/CDS.
  const isUsd = /USDT?$|USDC$/.test(symbol.toUpperCase());

  const fmtPrice = (v: number | null | undefined) => {
    if (v == null) return "—";
    const prefix = isUsd ? "$" : "₹";
    return `${prefix}${formatNumber(v, 2)}`;
  };

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
            {symbol}
          </Text>
          <Text
            style={{ color: changeTone, fontSize: 12, fontWeight: "600", marginTop: 3 }}
          >
            {changePct != null ? `${formatSigned(changePct)}%` : ""}
          </Text>
        </View>
        {/* Bid (red, top) / Ask (green, bottom) — the same right-aligned
            stacked pair the web shows on every row. Live ticks update both
            independently; fallback uses LTP for instruments without depth. */}
        <View style={{ alignItems: "flex-end", minWidth: 100 }}>
          <Text
            mono
            style={{
              color: colors.sell,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {fmtPrice(bid)}
          </Text>
          <Text
            mono
            style={{
              color: colors.buy,
              fontSize: 14,
              fontWeight: "700",
              marginTop: 2,
            }}
          >
            {fmtPrice(ask)}
          </Text>
        </View>
        {onToggleStar ? (
          <Pressable
            hitSlop={10}
            onPress={onToggleStar}
            style={{ marginLeft: 12, padding: 2 }}
          >
            <Ionicons
              name={starred ? "star" : "star-outline"}
              size={18}
              color={starred ? "#F59E0B" : colors.textMuted}
            />
          </Pressable>
        ) : null}
        {trailing && onTrailing ? (
          <Pressable
            hitSlop={10}
            onPress={onTrailing}
            style={{ marginLeft: 10 }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor:
                  trailing === "add" ? colors.primary : colors.bgElevated,
                borderWidth: trailing === "remove" ? 1 : 0,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={trailing === "add" ? "add" : "close"}
                size={trailing === "add" ? 18 : 14}
                color={trailing === "add" ? "#fff" : colors.textMuted}
              />
            </View>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export const InstrumentRow = memo(InstrumentRowImpl);
