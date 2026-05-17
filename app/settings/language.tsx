import { useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { colors } from "@shared/theme";
import { LANGUAGES, useLanguageStore } from "@shared/store/language.store";

export default function LanguageScreen() {
  const code = useLanguageStore((s) => s.code);
  const hydrated = useLanguageStore((s) => s.hydrated);
  const hydrate = useLanguageStore((s) => s.hydrate);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16 }}>
        <Header title="Language" back />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text tone="muted" size="sm" style={{ marginBottom: 12 }}>
          Choose the language you'd like to use.
        </Text>
        {LANGUAGES.map((lang) => {
          const selected = code === lang.code;
          return (
            <Pressable key={lang.code} onPress={() => void setLanguage(lang.code)}>
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
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600", fontSize: 15 }}>{lang.label}</Text>
                  <Text tone="muted" size="sm" style={{ marginTop: 2 }}>
                    {lang.native}
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
