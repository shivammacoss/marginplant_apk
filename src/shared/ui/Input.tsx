import { forwardRef, memo, useState } from "react";
import { Pressable, TextInput, TextInputProps, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "@shared/theme";
import { Text } from "./Text";

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  trailing?: React.ReactNode;
}

const InputImpl = forwardRef<TextInput, Props>(function Input(
  { label, error, hint, trailing, style, secureTextEntry, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const isPassword = !!secureTextEntry;
  const masked = isPassword && !visible;

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text tone="muted" size="sm" style={{ marginLeft: spacing.xs }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.bgElevated,
          borderRadius: radii.md,
          borderWidth: 1,
          paddingHorizontal: spacing.md,
          borderColor: error ? colors.sell : colors.border,
        }}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textDim}
          style={[
            {
              flex: 1,
              color: colors.text,
              paddingVertical: spacing.md,
              fontSize: typography.size.md,
              fontFamily: typography.family,
            },
            style,
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={masked}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            style={{ paddingLeft: spacing.sm }}
          >
            <Ionicons
              name={visible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
        {trailing}
      </View>
      {error ? (
        <Text tone="sell" size="sm" style={{ marginLeft: spacing.xs }}>
          {error}
        </Text>
      ) : hint ? (
        <Text tone="dim" size="sm" style={{ marginLeft: spacing.xs }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

export const Input = memo(InputImpl);
