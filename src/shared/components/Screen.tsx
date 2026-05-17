import { ReactNode, memo } from "react";
import { View, ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@shared/theme";

interface Props extends ViewProps {
  children: ReactNode;
  padded?: boolean;
  edges?: ("top" | "right" | "bottom" | "left")[];
}

function ScreenImpl({ children, padded = true, edges, style, ...rest }: Props) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={edges ?? ["top"]}>
      <View
        {...rest}
        style={[
          {
            flex: 1,
            backgroundColor: colors.bg,
            paddingHorizontal: padded ? spacing.lg : 0,
            paddingTop: padded ? spacing.md : 0,
          },
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

export const Screen = memo(ScreenImpl);
