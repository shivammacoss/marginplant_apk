import { View } from "react-native";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { colors } from "@shared/theme";

export default function TerminalScreen() {
  return (
    <Screen padded={false}>
      <Header title="Terminal" back />
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bgElevated,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text variant="title" weight="semibold">Pro Charts</Text>
        <Text tone="muted" style={{ marginTop: 8, textAlign: "center" }}>
          Wagmi-charts candle view, indicators, depth ladder, hotkey order entry — coming next.
        </Text>
      </View>
    </Screen>
  );
}
