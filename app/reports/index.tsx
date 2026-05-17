import { ScrollView } from "react-native";
import { router } from "expo-router";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Row } from "@shared/ui/Row";

export default function ReportsHome() {
  return (
    <Screen padded={false}>
      <Header title="Reports" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16 }}>
        <Row icon="trending-up-outline" title="P&L" divider onPress={() => router.push("/reports/pnl")} />
        <Row icon="receipt-outline" title="Tradebook" divider onPress={() => router.push("/reports/tradebook")} />
        <Row icon="cash-outline" title="Brokerage" divider onPress={() => router.push("/reports/brokerage")} />
        <Row icon="bar-chart-outline" title="Margin" divider onPress={() => router.push("/reports/margin")} />
        <Row icon="document-text-outline" title="Tax" onPress={() => router.push("/reports/tax")} />
      </ScrollView>
    </Screen>
  );
}
