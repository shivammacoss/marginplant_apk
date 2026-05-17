import { memo } from "react";
import { Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";

interface Props {
  onPress: () => void;
}

function TradeTabButtonImpl({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-start",
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={[colors.gradientFrom, colors.gradientVia, colors.gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="swap-vertical" size={16} color="#fff" />
        </LinearGradient>
      </View>
      <Text
        size="xs"
        tone="muted"
        style={{ marginTop: 2, fontSize: 10.5, fontWeight: "500" }}
      >
        Trade
      </Text>
    </Pressable>
  );
}

export const TradeTabButton = memo(TradeTabButtonImpl);
