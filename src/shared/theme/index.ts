import { colors } from "./colors";
import { spacing } from "./spacing";
import { typography } from "./typography";
import { shadows } from "./shadows";
import { radii } from "./radii";

export const theme = { colors, spacing, typography, shadows, radii } as const;
export type Theme = typeof theme;
export { colors, spacing, typography, shadows, radii };
export { darkPalette, lightPalette, applyPalette } from "./colors";
export type { ColorToken, Palette } from "./colors";
export type { SpacingToken } from "./spacing";
export type { FontSize, FontWeight, TypographyVariant } from "./typography";
export type { ShadowToken } from "./shadows";
export type { RadiusToken } from "./radii";
