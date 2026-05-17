import { Link, Stack } from "expo-router";
import { View } from "react-native";
import { colors, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.md,
        }}
      >
        <Text variant="title" weight="semibold">
          Screen not found
        </Text>
        <Link href="/" style={{ marginTop: spacing.md }}>
          <Text tone="info">Go home</Text>
        </Link>
      </View>
    </>
  );
}
