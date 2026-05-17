import { memo, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";

interface Props {
  onSearch?: () => void;
  hasProfileBadge?: boolean;
}

const PILL_HEIGHT = 48;

function StackedTile({
  iconNode,
  label,
  onPress,
  badge,
}: {
  iconNode: ReactNode;
  label: string;
  onPress: () => void;
  badge?: boolean;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <View
        style={{
          height: PILL_HEIGHT,
          minWidth: 62,
          paddingHorizontal: 12,
          backgroundColor: colors.bgElevated,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {badge ? (
          <View
            style={{
              position: "absolute",
              top: 7,
              right: 10,
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: colors.sell,
              zIndex: 1,
            }}
          />
        ) : null}
        {iconNode}
        <Text size="xs" tone="muted" style={{ fontWeight: "500", marginTop: 2, fontSize: 10 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function TopBarImpl({ onSearch, hasProfileBadge }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
      }}
    >
      <Pressable
        onPress={onSearch ?? (() => router.push("/search"))}
        style={{ flex: 1, marginRight: 8 }}
      >
        <View
          style={{
            height: PILL_HEIGHT,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.bgElevated,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <Text style={{ fontSize: 13, color: colors.text, marginLeft: 8 }}>
            Search <Text tone="dim">options</Text>
          </Text>
        </View>
      </Pressable>
      <View style={{ marginRight: 8 }}>
        <StackedTile
          iconNode={
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, lineHeight: 16 }}>
              ₹
            </Text>
          }
          label="Funds"
          onPress={() => router.push("/wallet")}
        />
      </View>
      <StackedTile
        iconNode={<Ionicons name="person-outline" size={14} color={colors.text} />}
        label="Profile"
        onPress={() => router.push("/profile")}
        badge={hasProfileBadge}
      />
    </View>
  );
}

export const TopBar = memo(TopBarImpl);
