import { ReactNode, memo } from "react";
import { View, ViewProps } from "react-native";
import { colors, radii, spacing } from "@shared/theme";

interface Props extends ViewProps {
  children: ReactNode;
  padded?: boolean;
  bordered?: boolean;
}

function CardImpl({ children, padded = true, bordered = true, style, ...rest }: Props) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.bgElevated,
          borderRadius: radii.lg,
          padding: padded ? spacing.lg : 0,
          borderWidth: bordered ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const Card = memo(CardImpl);
