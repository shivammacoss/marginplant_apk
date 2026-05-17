import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { Row } from "@shared/ui/Row";
import { Toggle } from "@shared/ui/Toggle";
import { colors } from "@shared/theme";
import { useNotifPrefsStore } from "@shared/store/notifications.store";

export default function NotificationsSettingsScreen() {
  const trades = useNotifPrefsStore((s) => s.trades);
  const priceAlerts = useNotifPrefsStore((s) => s.priceAlerts);
  const marketNews = useNotifPrefsStore((s) => s.marketNews);
  const promos = useNotifPrefsStore((s) => s.promos);
  const setPref = useNotifPrefsStore((s) => s.set);
  const hydrated = useNotifPrefsStore((s) => s.hydrated);
  const hydrate = useNotifPrefsStore((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16 }}>
        <Header title="Notifications" back />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text tone="muted" size="sm">
          Pick which alerts you want to receive on this device.
        </Text>
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
          }}
        >
          <Row
            icon="swap-horizontal-outline"
            title="Order & trade updates"
            subtitle="Order filled, cancelled, modified"
            chevron={false}
            divider
            rightNode={<Toggle value={trades} onChange={(v) => setPref("trades", v)} />}
          />
          <Row
            icon="trending-up-outline"
            title="Price alerts"
            subtitle="Alerts you set on instruments"
            chevron={false}
            divider
            rightNode={
              <Toggle value={priceAlerts} onChange={(v) => setPref("priceAlerts", v)} />
            }
          />
          <Row
            icon="newspaper-outline"
            title="Market news"
            subtitle="Breaking market events"
            chevron={false}
            divider
            rightNode={<Toggle value={marketNews} onChange={(v) => setPref("marketNews", v)} />}
          />
          <Row
            icon="megaphone-outline"
            title="Offers & promotions"
            subtitle="Occasional product updates"
            chevron={false}
            rightNode={<Toggle value={promos} onChange={(v) => setPref("promos", v)} />}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
