import { memo, type ReactNode } from "react";
import { Pressable, View, type PressableProps } from "react-native";
import { colors } from "@shared/theme";
import { Text } from "./Text";

interface Props extends Omit<PressableProps, "children" | "style"> {
  label: string;
  active?: boolean;
  leading?: ReactNode;
  size?: "sm" | "md";
}

function ChipImpl({ label, active, leading, size = "md", ...rest }: Props) {
  const paddingV = size === "sm" ? 8 : 12;
  const paddingH = size === "sm" ? 12 : 18;
  return (
    <Pressable {...rest}>
      <View
        style={{
          backgroundColor: active ? colors.text : colors.bgChip,
          borderRadius: 999,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
          flexDirection: "row",
          alignItems: "center",
          borderWidth: active ? 0 : 1,
          borderColor: colors.border,
        }}
      >
        {leading ? <View style={{ marginRight: 6 }}>{leading}</View> : null}
        <Text
          style={{
            color: active ? colors.textInverse : colors.text,
            fontSize: size === "sm" ? 12 : 14,
            fontWeight: "500",
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export const Chip = memo(ChipImpl);
