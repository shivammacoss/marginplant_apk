import { memo, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
  badge?: ReactNode;
}

function QuickTileImpl({ icon, title, subtitle, onPress, badge }: Props) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View
        style={{
          backgroundColor: colors.bgElevated,
          borderRadius: 12,
          padding: 12,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {badge ? <View style={{ position: "absolute", top: 6, right: 8 }}>{badge}</View> : null}
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <Text style={{ fontWeight: "600", fontSize: 13, marginTop: 6 }}>{title}</Text>
        <Text tone="muted" size="xs" style={{ textAlign: "center", marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

export const QuickTile = memo(QuickTileImpl);
