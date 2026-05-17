import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { colors } from "@shared/theme";
import { useThemeStore, type ThemeMode } from "@shared/store/theme.store";

interface Option {
  mode: ThemeMode;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const OPTIONS: Option[] = [
  { mode: "dark", title: "Dark", subtitle: "Easier on the eyes at night", icon: "moon-outline" },
  { mode: "light", title: "Light", subtitle: "Clean white interface", icon: "sunny-outline" },
  {
    mode: "system",
    title: "Use system setting",
    subtitle: "Match your phone's appearance",
    icon: "phone-portrait-outline",
  },
];

export default function ThemeScreen() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16 }}>
        <Header title="Theme" back />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text tone="muted" size="sm" style={{ marginBottom: 12 }}>
          Choose how MarginPlant should look on this device.
        </Text>
        {OPTIONS.map((opt) => {
          const selected = mode === opt.mode;
          return (
            <Pressable key={opt.mode} onPress={() => setMode(opt.mode)}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  marginBottom: 10,
                  backgroundColor: colors.bgElevated,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.bgSurface,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Ionicons name={opt.icon} size={18} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600", fontSize: 15 }}>{opt.title}</Text>
                  <Text tone="muted" size="sm" style={{ marginTop: 2 }}>
                    {opt.subtitle}
                  </Text>
                </View>
                <Ionicons
                  name={selected ? "radio-button-on" : "radio-button-off"}
                  size={22}
                  color={selected ? colors.primary : colors.textDim}
                  style={{ marginLeft: 8 }}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
