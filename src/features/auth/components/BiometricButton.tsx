import { memo } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";

interface Props {
  onPress: () => void;
  label?: string;
  disabled?: boolean;
}

function BiometricButtonImpl({ onPress, label = "Enable biometric", disabled }: Props) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ alignSelf: "center" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.bgElevated,
          borderRadius: 14,
          paddingVertical: 16,
          paddingHorizontal: 24,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Ionicons name="finger-print" size={22} color={colors.text} style={{ marginRight: 10 }} />
        <Text style={{ fontWeight: "500" }}>{label}</Text>
      </View>
    </Pressable>
  );
}

export const BiometricButton = memo(BiometricButtonImpl);
