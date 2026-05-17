import { ReactNode, memo } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { goBack } from "@shared/utils/navigation";

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}

function HeaderImpl({ title, subtitle, back, right }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        {back ? (
          <Pressable onPress={() => goBack("/(tabs)")} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : null}
        <View>
          <Text variant="title" weight="semibold">
            {title}
          </Text>
          {subtitle ? (
            <Text tone="muted" size="sm">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right}
    </View>
  );
}

export const Header = memo(HeaderImpl);
