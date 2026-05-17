import { memo } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { formatNumber, formatSigned } from "@shared/utils/format";

interface Props {
  symbol: string;
  name: string;
  exchange: string;
  ltp: number;
  change: number;
  changePct: number;
  aiTag?: boolean;
  onPress?: () => void;
}

function StockRowImpl({ symbol, name, exchange, ltp, change, changePct, aiTag, onPress }: Props) {
  const isUp = change >= 0;
  const tone = isUp ? colors.buy : colors.sell;
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "500" }}>{name}</Text>
            {aiTag ? (
              <View
                style={{
                  backgroundColor: "rgba(168,85,247,0.18)",
                  borderRadius: 4,
                  paddingHorizontal: 4,
                  paddingVertical: 1,
                  marginLeft: 6,
                }}
              >
                <Ionicons name="sparkles" size={11} color={colors.primary} />
              </View>
            ) : null}
          </View>
          <Text tone="dim" size="xs" style={{ marginTop: 4 }}>
            {exchange}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 15, fontWeight: "500" }}>{formatNumber(ltp)}</Text>
          <Text style={{ color: tone, fontSize: 12, marginTop: 4 }}>
            {formatSigned(change)} ({formatSigned(changePct)}%)
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export const StockRow = memo(StockRowImpl);
