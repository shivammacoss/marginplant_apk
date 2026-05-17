import { memo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";

export const SEGMENT_TABS = ["Stocks", "Forex", "Crypto"] as const;
export type SegmentTab = (typeof SEGMENT_TABS)[number];

interface Props {
  active: SegmentTab;
  onChange: (t: SegmentTab) => void;
}

function SegmentTabsImpl({ active, onChange }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 12, alignItems: "center" }}
        style={{ flex: 1 }}
      >
        {SEGMENT_TABS.map((t) => {
          const isActive = t === active;
          return (
            <Pressable
              key={t}
              onPress={() => onChange(t)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                alignItems: "center",
              }}
            >
              <Text
                tone={isActive ? "default" : "muted"}
                style={{
                  fontSize: 15,
                  fontWeight: isActive ? "700" : "500",
                }}
              >
                {t}
              </Text>
              <View
                style={{
                  height: 2,
                  width: "100%",
                  marginTop: 6,
                  backgroundColor: isActive ? colors.text : "transparent",
                  borderRadius: 1,
                }}
              />
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        onPress={() => router.push("/settings")}
        hitSlop={10}
        style={{ paddingHorizontal: 10, paddingVertical: 10 }}
      >
        <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

export const SegmentTabs = memo(SegmentTabsImpl);
