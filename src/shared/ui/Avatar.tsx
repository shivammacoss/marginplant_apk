import { memo } from "react";
import { View } from "react-native";
import { colors } from "@shared/theme";
import { Text } from "./Text";

interface Props {
  name?: string | null;
  size?: number;
  bg?: string;
}

function getInitial(name?: string | null): string {
  if (!name) return "?";
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() || "?";
}

function AvatarImpl({ name, size = 80, bg = colors.avatarTeal }: Props) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontSize: size * 0.4, fontWeight: "600" }}>
        {getInitial(name)}
      </Text>
    </View>
  );
}

export const Avatar = memo(AvatarImpl);
