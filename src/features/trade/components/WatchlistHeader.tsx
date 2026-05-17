import { memo } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";

interface Props {
  listName: string;
  onMenu?: () => void;
  onAdd?: () => void;
  onFilter?: () => void;
}

function WatchlistHeaderImpl({ listName, onMenu, onAdd, onFilter }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: 8,
      }}
    >
      <Pressable
        onPress={onMenu}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600" }}>{listName}</Text>
        <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
      </Pressable>
      <View style={{ flex: 1 }} />
      <Pressable onPress={onAdd} hitSlop={10} style={{ padding: 6 }}>
        <Ionicons name="add" size={22} color={colors.text} />
      </Pressable>
      <Pressable
        onPress={onFilter}
        style={{
          marginLeft: 6,
          backgroundColor: colors.bgElevated,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="options-outline" size={16} color={colors.text} />
      </Pressable>
    </View>
  );
}

export const WatchlistHeader = memo(WatchlistHeaderImpl);
