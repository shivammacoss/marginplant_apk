import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { Card } from "@shared/ui/Card";
import { colors } from "@shared/theme";
import { useNetworkState } from "@shared/hooks/useNetworkState";

export default function NetworkScreen() {
  const { isConnected, isInternetReachable, type } = useNetworkState();
  const ok = isConnected && isInternetReachable !== false;
  return (
    <Screen>
      <Header title="Internet connectivity" back />
      <View style={{ alignItems: "center", paddingTop: 40, gap: 18 }}>
        <Ionicons
          name={ok ? "checkmark-circle" : "close-circle"}
          size={84}
          color={ok ? colors.buy : colors.sell}
        />
        <Text style={{ fontSize: 20, fontWeight: "600" }}>{ok ? "Online" : "Offline"}</Text>
        <Text tone="muted">{type ?? "unknown"}</Text>
      </View>
      <View style={{ marginTop: 24 }}>
        <Card>
          <Text tone="muted" size="sm">
            Reachability: {isInternetReachable === null ? "unknown" : isInternetReachable ? "yes" : "no"}
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
