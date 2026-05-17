import { Linking, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { goBack } from "@shared/utils/navigation";
import { Avatar } from "@shared/ui/Avatar";
import { Text } from "@shared/ui/Text";
import { Row } from "@shared/ui/Row";
import { colors } from "@shared/theme";
import { formatINR } from "@shared/utils/format";
import { useAuthStore } from "@features/auth/store/auth.store";
import { useLogout } from "@features/auth/hooks/useAuth";
import { useWallet } from "@features/wallet/hooks/useWallet";
import { QuickTile } from "@features/profile/components/QuickTile";
import { ProfileSection } from "@features/profile/components/ProfileSection";
import {
  buildMailtoUrl,
  buildWhatsappUrl,
  useSupportContacts,
} from "@features/support/useSupport";

// Every row here maps 1:1 onto a backend endpoint that exists in
// `marginplant_ind/backend`. Anything that doesn't have a backend
// counterpart has been removed so we don't ship dead-end UI.
//   Funds tile           → GET /user/wallet/summary
//   Account details      → PUT /user/users/me (full_name) + change password
//   Statements / P&L     → GET /user/reports/pnl + /tradebook + /tax
//   Bank Accounts        → GET / POST /user/wallet/bank-accounts
//   Notifications        → GET /user/notifications
//   Settings             → local stores (theme / language / biometric)
//   Logout               → POST /user/auth/logout
export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { data: wallet } = useWallet();
  const { data: support } = useSupportContacts();
  // Pre-compose the launchable URLs once per render. Both helpers
  // return null when the underlying value is unset or invalid, so the
  // Support section below hides individual rows that have no target.
  const supportEmailUrl = buildMailtoUrl(support?.email, {
    subject: "MarginPlant support request",
  });
  const supportWaUrl = buildWhatsappUrl(
    support?.whatsapp,
    "Hi, I need help with my MarginPlant account",
  );
  const hasSupport = !!(supportEmailUrl || supportWaUrl);

  const fundsLabel = wallet ? formatINR(wallet.available_balance) : "₹0.00";

  return (
    <Screen padded={false}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Pressable hitSlop={10} onPress={() => goBack("/(tabs)")}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable hitSlop={10} onPress={() => router.push("/settings")}>
          <Ionicons name="settings-outline" size={22} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <View style={{ alignItems: "center" }}>
          <Avatar name={user?.full_name} size={92} />
          <Text style={{ fontSize: 22, fontWeight: "600", marginTop: 10 }}>
            {user?.full_name?.toUpperCase() ?? "TRADER"}
          </Text>
          {user?.email ? (
            <Text tone="muted" size="sm" style={{ marginTop: 4 }}>
              {user.email}
            </Text>
          ) : null}
          {user?.mobile ? (
            <Text tone="dim" size="xs" style={{ marginTop: 2 }}>
              {user.mobile}
            </Text>
          ) : null}
          <Pressable onPress={() => router.push("/profile/account")}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.bgElevated,
              }}
            >
              <Ionicons name="pencil" size={12} color={colors.textMuted} />
              <Text size="xs" tone="muted" style={{ marginLeft: 6, fontWeight: "600" }}>
                Edit profile
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", marginTop: 16 }}>
          <QuickTile
            icon="cash-outline"
            title={fundsLabel}
            subtitle="Funds"
            onPress={() => router.push("/wallet")}
          />
          <View style={{ width: 10 }} />
          <QuickTile
            icon="calendar-outline"
            title="P&L"
            subtitle="Daily / Monthly"
            onPress={() => router.push("/reports/pnl")}
          />
          <View style={{ width: 10 }} />
          <QuickTile
            icon="notifications-outline"
            title="Alerts"
            subtitle="Notifications"
            onPress={() => router.push("/notifications")}
          />
        </View>

        <View style={{ marginTop: 16 }}>
          <ProfileSection title="Account">
            <Row
              icon="person-outline"
              title="Account details"
              subtitle="Name, email, mobile, KYC"
              divider
              onPress={() => router.push("/profile/account")}
            />
            <Row
              icon="lock-closed-outline"
              title="Change password"
              onPress={() => router.push("/profile/change-password")}
            />
          </ProfileSection>
        </View>

        <View style={{ marginTop: 12 }}>
          <ProfileSection title="Reports">
            <Row
              icon="document-text-outline"
              title="Statements"
              subtitle="P&L, tradebook, tax"
              divider
              onPress={() => router.push("/reports/pnl")}
            />
            <Row
              icon="receipt-outline"
              title="Transaction history"
              onPress={() => router.push("/wallet/transactions")}
            />
          </ProfileSection>
        </View>

        <View style={{ marginTop: 12 }}>
          <ProfileSection title="Preferences">
            <Row
              icon="settings-outline"
              title="App settings"
              subtitle="Theme, language, biometric, notifications"
              divider
              onPress={() => router.push("/settings")}
            />
            <Row
              icon="cloud-download-outline"
              title="App updates"
              subtitle="Check what's new and grab the latest build"
              onPress={() => router.push("/profile/update")}
            />
          </ProfileSection>
        </View>

        {hasSupport ? (
          <View style={{ marginTop: 12 }}>
            <ProfileSection title="Support">
              {supportWaUrl ? (
                <Row
                  icon="logo-whatsapp"
                  title="WhatsApp support"
                  subtitle={support?.whatsapp || "Chat with us"}
                  divider={!!supportEmailUrl}
                  onPress={() => {
                    void Linking.openURL(supportWaUrl);
                  }}
                />
              ) : null}
              {supportEmailUrl ? (
                <Row
                  icon="mail-outline"
                  title="Email support"
                  subtitle={support?.email || "support@marginplant.com"}
                  onPress={() => {
                    void Linking.openURL(supportEmailUrl);
                  }}
                />
              ) : null}
            </ProfileSection>
          </View>
        ) : null}

        <View style={{ marginTop: 16 }}>
          <Pressable onPress={() => logout.mutate()}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.bgElevated,
              }}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.sell} />
              <Text style={{ color: colors.sell, fontWeight: "600", marginLeft: 10 }}>
                {logout.isPending ? "Signing out…" : "Logout"}
              </Text>
            </View>
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 18,
            paddingHorizontal: 4,
          }}
        >
          <Text tone="dim" size="xs">
            MarginPlant · v1.0.0
          </Text>
          <Text tone="dim" size="xs">
            Made in India
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
