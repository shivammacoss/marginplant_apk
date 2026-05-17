import { ActivityIndicator, Pressable, PressableProps, View } from "react-native";
import { ReactNode, memo } from "react";
import { colors, radii, spacing, typography } from "@shared/theme";
import { Text } from "./Text";

type Variant = "primary" | "buy" | "sell" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: ReactNode;
  fullWidth?: boolean;
}

const PADV: Record<Size, number> = { sm: spacing.sm, md: spacing.md, lg: spacing.lg };

// `colors` is mutated by applyPalette on theme change — look up live values
// on each render so dark↔light switches actually paint.
function bgFor(variant: Variant): string {
  switch (variant) {
    case "primary":
      return colors.primary;
    case "buy":
      return colors.buy;
    case "sell":
      return colors.sell;
    case "danger":
      return colors.danger;
    case "ghost":
      return "transparent";
  }
}

function fgFor(variant: Variant): string {
  switch (variant) {
    case "primary":
    case "buy":
      return colors.textInverse;
    case "ghost":
    case "sell":
    case "danger":
      return colors.text;
  }
}

function ButtonImpl({
  label,
  variant = "primary",
  size = "md",
  loading,
  leadingIcon,
  fullWidth,
  disabled,
  ...rest
}: Props) {
  const bg = bgFor(variant);
  const fg = fgFor(variant);
  return (
    <Pressable {...rest} disabled={disabled || loading}>
      <View
        style={{
          borderRadius: radii.md,
          paddingHorizontal: spacing.lg,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          paddingVertical: PADV[size],
          opacity: disabled ? 0.4 : 1,
          width: fullWidth ? "100%" : undefined,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: colors.border,
          flexDirection: "row",
        }}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            {leadingIcon ? <View style={{ marginRight: spacing.sm }}>{leadingIcon}</View> : null}
            <Text
              style={{
                color: fg,
                fontSize: typography.size[size === "sm" ? "sm" : "md"],
                fontWeight: typography.weight.semibold as "600",
              }}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

export const Button = memo(ButtonImpl);
