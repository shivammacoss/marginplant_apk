import { memo } from "react";
import { Pressable, View } from "react-native";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { formatNumber, formatSigned } from "@shared/utils/format";

interface Props {
  symbol: string;
  token?: string;
  ltp: number;
  change: number;
  changePct: number;
  onPress?: () => void;
}

function IndexCardImpl({ symbol, ltp, change, changePct, onPress }: Props) {
  const noData = ltp === 0;
  const isUp = change >= 0;
  const tone = noData ? colors.textDim : isUp ? colors.buy : colors.sell;

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          width: 168,
          backgroundColor: colors.bgElevated,
          borderRadius: 16,
          padding: 14,
        }}
      >
        <Text tone="muted" size="sm">
          {symbol}
        </Text>
        <Text
          mono
          style={{
            fontSize: 20,
            fontWeight: "700",
            marginTop: 6,
            color: noData ? colors.textDim : colors.text,
          }}
        >
          {noData ? "—" : formatNumber(ltp)}
        </Text>
        <Text
          mono
          style={{ color: tone, fontSize: 12, fontWeight: "600", marginTop: 4 }}
        >
          {noData
            ? "—"
            : `${formatSigned(change)} (${formatSigned(changePct)}%)`}
        </Text>
      </View>
    </Pressable>
  );
}

export const IndexCard = memo(IndexCardImpl);
