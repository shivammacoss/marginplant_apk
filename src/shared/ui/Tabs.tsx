import { memo } from "react";
import { Pressable, View } from "react-native";
import { colors } from "@shared/theme";
import { Text } from "./Text";

export interface TabItem {
  key: string;
  label: string;
}

interface Props {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  variant?: "underline" | "pill";
}

function TabsImpl({ items, activeKey, onChange, variant = "underline" }: Props) {
  if (variant === "pill") {
    return (
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          padding: 4,
          backgroundColor: colors.bgElevated,
          borderRadius: 999,
        }}
      >
        {items.map((it) => {
          const active = it.key === activeKey;
          return (
            <Pressable
              key={it.key}
              onPress={() => onChange(it.key)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: active ? colors.bgSurface : "transparent",
                alignItems: "center",
              }}
            >
              <Text
                tone={active ? "default" : "muted"}
                style={{ fontWeight: active ? "600" : "400" }}
              >
                {it.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", gap: 24 }}>
      {items.map((it) => {
        const active = it.key === activeKey;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={{ paddingVertical: 10 }}
          >
            <Text
              tone={active ? "default" : "muted"}
              style={{ fontSize: 17, fontWeight: active ? "600" : "400" }}
            >
              {it.label}
            </Text>
            {active ? (
              <View
                style={{
                  height: 2,
                  marginTop: 6,
                  backgroundColor: colors.text,
                  borderRadius: 1,
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export const Tabs = memo(TabsImpl);
