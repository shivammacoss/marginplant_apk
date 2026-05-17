import { memo } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";

interface Props {
  title: string;
  highlight?: string;
  subtitle: string;
  onClose?: () => void;
  onPress?: () => void;
}

function PromoCardImpl({ title, highlight, subtitle, onClose, onPress }: Props) {
  return (
    <Pressable onPress={onPress}>
      <View style={{ borderRadius: 16, overflow: "hidden" }}>
        <LinearGradient
          colors={["#1f1b3e", "#2a1638", "#1a1a1a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 16 }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600", flex: 1 }}>
              {title}
              {highlight ? (
                <Text style={{ color: colors.gradientVia, fontWeight: "600" }}> {highlight}</Text>
              ) : null}
            </Text>
            {onClose ? (
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Text tone="muted" size="sm" style={{ maxWidth: "85%", marginTop: 6 }}>
            {subtitle}
          </Text>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

export const PromoCard = memo(PromoCardImpl);
