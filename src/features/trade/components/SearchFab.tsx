import { memo } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors, shadows } from "@shared/theme";
import { Text } from "@shared/ui/Text";

interface Props {
  onFilter?: () => void;
}

function SearchFabImpl({ onFilter }: Props) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 76,
        left: 16,
        right: 16,
        flexDirection: "row",
        gap: 12,
      }}
    >
      <Pressable
        onPress={onFilter}
        style={{
          backgroundColor: colors.bgElevated,
          borderRadius: 999,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.lg,
        }}
      >
        <Ionicons name="options-outline" size={18} color={colors.text} />
      </Pressable>
      <Pressable
        onPress={() => router.push("/search")}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: colors.bgElevated,
          borderRadius: 999,
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.lg,
        }}
      >
        <Ionicons name="search" size={18} color={colors.text} />
        <Text style={{ fontWeight: "500" }}>Search & Add</Text>
      </Pressable>
    </View>
  );
}

export const SearchFab = memo(SearchFabImpl);
