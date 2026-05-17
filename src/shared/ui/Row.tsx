import { memo, type ReactNode } from "react";
import { Pressable, View, type PressableProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@shared/theme";
import { Text } from "./Text";

interface Props extends Omit<PressableProps, "children" | "style"> {
  icon?: keyof typeof Ionicons.glyphMap;
  iconNode?: ReactNode;
  title: string;
  subtitle?: string;
  rightLabel?: string;
  rightNode?: ReactNode;
  chevron?: boolean;
  divider?: boolean;
}

function RowImpl({
  icon,
  iconNode,
  title,
  subtitle,
  rightLabel,
  rightNode,
  chevron = true,
  divider,
  ...rest
}: Props) {
  return (
    <Pressable {...rest}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 4,
          borderBottomWidth: divider ? 1 : 0,
          borderBottomColor: colors.border,
        }}
      >
        {iconNode ? (
          <View style={{ marginRight: 14 }}>{iconNode}</View>
        ) : icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={colors.textMuted}
            style={{ marginRight: 14 }}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "500" }}>{title}</Text>
          {subtitle ? (
            <Text tone="muted" size="sm" style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {rightNode ?? (rightLabel ? <Text tone="muted">{rightLabel}</Text> : null)}
        {chevron && !rightNode ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textDim}
            style={{ marginLeft: 6 }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export const Row = memo(RowImpl);
