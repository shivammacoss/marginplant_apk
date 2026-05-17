import { memo } from "react";
import { View } from "react-native";
import { colors } from "@shared/theme";
import { Text } from "./Text";

type Tone = "neutral" | "buy" | "sell" | "warn" | "info" | "primary";

interface Props {
  label: string;
  tone?: Tone;
  size?: "sm" | "md";
}

const BG: Record<Tone, string> = {
  neutral: colors.bgSurface,
  buy: colors.buyDim,
  sell: colors.sellDim,
  warn: "#7c2d12",
  info: "#1e3a8a",
  primary: colors.primary,
};

const FG: Record<Tone, string> = {
  neutral: colors.textMuted,
  buy: colors.buy,
  sell: colors.sell,
  warn: colors.warn,
  info: colors.info,
  primary: "#fff",
};

function BadgeImpl({ label, tone = "neutral", size = "sm" }: Props) {
  return (
    <View
      style={{
        backgroundColor: BG[tone],
        paddingVertical: size === "sm" ? 3 : 5,
        paddingHorizontal: size === "sm" ? 8 : 10,
        borderRadius: 6,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          color: FG[tone],
          fontSize: size === "sm" ? 10 : 12,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export const Badge = memo(BadgeImpl);
