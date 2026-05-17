import { memo } from "react";
import { ActivityIndicator, Pressable, View, type PressableProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@shared/theme";
import { Text } from "./Text";

interface Props extends Omit<PressableProps, "children" | "style"> {
  label: string;
  loading?: boolean;
  fullWidth?: boolean;
}

function GradientButtonImpl({ label, loading, fullWidth = true, disabled, ...rest }: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable {...rest} disabled={isDisabled}>
      <View
        style={{
          width: fullWidth ? "100%" : undefined,
          opacity: isDisabled ? 0.5 : 1,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={[colors.gradientFrom, colors.gradientVia, colors.gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingVertical: 18,
            paddingHorizontal: 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{label}</Text>
          )}
        </LinearGradient>
      </View>
    </Pressable>
  );
}

export const GradientButton = memo(GradientButtonImpl);
