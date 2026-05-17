import { Platform, ViewStyle } from "react-native";

const ios = (elevation: number, opacity: number): ViewStyle => ({
  shadowColor: "#000",
  shadowOpacity: opacity,
  shadowRadius: elevation,
  shadowOffset: { width: 0, height: elevation / 2 },
});

export const shadows = {
  none: {} as ViewStyle,
  sm: Platform.select({ ios: ios(4, 0.18), android: { elevation: 2 }, default: {} }) as ViewStyle,
  md: Platform.select({ ios: ios(8, 0.22), android: { elevation: 4 }, default: {} }) as ViewStyle,
  lg: Platform.select({ ios: ios(16, 0.3), android: { elevation: 8 }, default: {} }) as ViewStyle,
} as const;

export type ShadowToken = keyof typeof shadows;
