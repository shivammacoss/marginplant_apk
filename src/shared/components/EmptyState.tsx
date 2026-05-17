import { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { colors, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
}

function EmptyStateImpl({ icon = "documents-outline", title, description }: Props) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing["2xl"],
        gap: spacing.sm,
      }}
    >
      <Ionicons name={icon} size={36} color={colors.textDim} />
      <Text variant="heading" weight="semibold" style={{ marginTop: spacing.md }}>
        {title}
      </Text>
      {description ? (
        <Text tone="muted" style={{ textAlign: "center" }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export const EmptyState = memo(EmptyStateImpl);
