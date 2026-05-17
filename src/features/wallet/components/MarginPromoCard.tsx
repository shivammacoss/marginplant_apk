import { memo } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";

interface Props {
  onPress?: () => void;
}

function MarginPromoCardImpl({ onPress }: Props) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.bgElevated,
          borderRadius: 16,
          padding: 14,
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: "500", lineHeight: 22 }}>
            Get up to 94% interest-free margin on Stocks & ETFs
          </Text>
        </View>
        <Svg width={56} height={56} viewBox="0 0 60 60">
          <Defs>
            <LinearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FBBF24" />
              <Stop offset="1" stopColor="#F97316" />
            </LinearGradient>
          </Defs>
          <Path d="M10 40 L50 40 L50 50 L10 50 Z" stroke="url(#mg)" strokeWidth="1.2" fill="none" />
          <Path d="M14 30 L46 30 L46 40 L14 40 Z" stroke="url(#mg)" strokeWidth="1.2" fill="none" />
          <Path d="M18 20 L42 20 L42 30 L18 30 Z" stroke="url(#mg)" strokeWidth="1.2" fill="none" />
        </Svg>
        <Ionicons name="chevron-forward" size={18} color={colors.textDim} style={{ marginLeft: 8 }} />
      </View>
    </Pressable>
  );
}

export const MarginPromoCard = memo(MarginPromoCardImpl);
