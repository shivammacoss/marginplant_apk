import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { Loader } from "@shared/ui/Loader";
import { colors, spacing } from "@shared/theme";
import { fmtTime } from "@shared/utils/time";
import { useManualRefresh } from "@shared/hooks/useManualRefresh";
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
} from "@features/notifications/hooks/useNotifications";
import type {
  AppNotification,
  NotificationType,
} from "@features/notifications/types/notification.types";

const ICON: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  ORDER: "swap-vertical-outline",
  POSITION: "trending-up-outline",
  WALLET: "cash-outline",
  ALERT: "alarm-outline",
  KYC: "shield-checkmark-outline",
  SYSTEM: "information-circle-outline",
  MARKETING: "megaphone-outline",
};

function Row({ n, onTap }: { n: AppNotification; onTap: () => void }) {
  const icon = ICON[n.type] ?? "notifications-outline";
  return (
    <Pressable onPress={onTap}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 4,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: n.read ? "transparent" : "rgba(168,85,247,0.06)",
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.bgElevated,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={18} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: n.read ? "500" : "700" }} numberOfLines={2}>
            {n.title}
          </Text>
          {n.body ? (
            <Text tone="muted" size="sm" style={{ marginTop: 2 }} numberOfLines={2}>
              {n.body}
            </Text>
          ) : null}
          <Text tone="dim" size="xs" style={{ marginTop: 4 }}>
            {fmtTime(n.created_at)}
          </Text>
        </View>
        {!n.read ? (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.primary,
              marginTop: 6,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { data, isLoading, refetch } = useNotifications({ limit: 50 });
  const { refreshing, onRefresh } = useManualRefresh(async () => {
    await refetch();
  });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const rows = data ?? [];
  const hasUnread = rows.some((r) => !r.read);

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Header
          title="Notifications"
          back
          right={
            hasUnread ? (
              <Pressable onPress={() => markAll.mutate()} hitSlop={8}>
                <Text size="sm" style={{ color: colors.primary, fontWeight: "600" }}>
                  Mark all read
                </Text>
              </Pressable>
            ) : undefined
          }
        />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {isLoading ? (
          <Loader label="Loading…" />
        ) : rows.length === 0 ? (
          <View style={{ paddingVertical: 64, alignItems: "center", gap: 6 }}>
            <Ionicons name="notifications-off-outline" size={40} color={colors.textDim} />
            <Text tone="muted">You're all caught up</Text>
          </View>
        ) : (
          rows.map((n) => (
            <Row
              key={n.id}
              n={n}
              onTap={() => {
                if (!n.read) markRead.mutate(n.id);
              }}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
