import { memo } from "react";
import { ActivityIndicator, View } from "react-native";
import { colors } from "@shared/theme";
import { Text } from "./Text";

interface Props {
  label?: string;
  fullscreen?: boolean;
}

function LoaderImpl({ label, fullscreen }: Props) {
  return (
    <View
      style={{
        flex: fullscreen ? 1 : undefined,
        backgroundColor: fullscreen ? colors.bg : undefined,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 12,
      }}
    >
      <ActivityIndicator color={colors.primary} />
      {label ? <Text tone="muted">{label}</Text> : null}
    </View>
  );
}

export const Loader = memo(LoaderImpl);
