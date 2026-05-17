import { memo } from "react";
import { Pressable, View } from "react-native";
import { colors } from "@shared/theme";

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleImpl({ value, onChange, disabled }: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        padding: 3,
        backgroundColor: value ? colors.primary : colors.bgSurface,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: "#fff",
          transform: [{ translateX: value ? 18 : 0 }],
        }}
      />
    </Pressable>
  );
}

export const Toggle = memo(ToggleImpl);
