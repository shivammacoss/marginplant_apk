import { memo } from "react";
import { Text as RNText, TextProps as RNTextProps } from "react-native";
import {
  colors,
  typography,
  type FontSize,
  type FontWeight,
  type TypographyVariant,
} from "@shared/theme";

// Variants:
//   • Legacy:   body / heading / title / mono / caption — kept for the
//     thousand existing call sites so this upgrade can ship without a
//     screen-by-screen sweep.
//   • Modern:   subheading / numericValue / pnlPositive / pnlNegative /
//     labelMuted — sourced from the theme's typography token table.
//     Adopt these on new code; the legacy names will keep working.
type LegacyVariant = "body" | "heading" | "title" | "mono" | "caption";
type Variant = LegacyVariant | TypographyVariant;
type Tone = "default" | "muted" | "dim" | "buy" | "sell" | "warn" | "info";

interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  size?: FontSize;
  weight?: FontWeight;
  /** Force monospace family (legacy). Prefer `numeric` for aligned digits. */
  mono?: boolean;
  /**
   * Enable `font-variant-numeric: tabular-nums` so digits render at a
   * fixed width. Use on every price / quantity / P&L / percentage so
   * numbers stop wobbling as values tick. Implicit for the numeric /
   * pnl variants and for `mono` text.
   */
  numeric?: boolean;
}

// Default size when neither `size` nor a sized variant is supplied.
const LEGACY_SIZE: Record<LegacyVariant, FontSize> = {
  body: "md",
  heading: "xl",
  title: "2xl",
  mono: "md",
  caption: "sm",
};

// `colors` is mutated in-place by applyPalette() on theme switch, so we MUST
// look up colors on every render (no module-level const cache). Otherwise
// switching from dark → light would leave Text painted in the originally-
// captured dark-theme colours (white on white = invisible).
function resolveTone(tone: Tone): string {
  switch (tone) {
    case "default":
      return colors.text;
    case "muted":
      return colors.textMuted;
    case "dim":
      return colors.textDim;
    case "buy":
      return colors.buy;
    case "sell":
      return colors.sell;
    case "warn":
      return colors.warn;
    case "info":
      return colors.info;
  }
}

function isModernVariant(v: Variant): v is TypographyVariant {
  return v in typography.variants;
}

function TextImpl({
  variant = "body",
  tone,
  size,
  weight,
  mono,
  numeric,
  style,
  ...rest
}: TextProps) {
  // Modern variants pull their full style payload (fontFamily, size,
  // weight, lineHeight, letterSpacing, fontVariant) from the theme
  // token, then let explicit props override anything the caller wants.
  if (isModernVariant(variant)) {
    const token = typography.variants[variant];
    // pnlPositive / pnlNegative default to the matching semantic tone so
    // call sites don't have to remember "pnl variant + tone='buy'".
    const resolvedTone: Tone =
      tone ??
      (variant === "pnlPositive"
        ? "buy"
        : variant === "pnlNegative"
        ? "sell"
        : variant === "labelMuted" || variant === "caption"
        ? "muted"
        : "default");
    return (
      <RNText
        {...rest}
        style={[
          { includeFontPadding: false },
          token,
          { color: resolveTone(resolvedTone) },
          size ? { fontSize: typography.size[size] } : null,
          weight ? { fontWeight: typography.weight[weight] } : null,
          // Explicit `numeric` (or `mono`) still adds tabular-nums on
          // variants that didn't already include it — harmless on those
          // that did.
          numeric || mono ? { fontVariant: ["tabular-nums"] as ["tabular-nums"] } : null,
          mono ? { fontFamily: typography.familyMono } : null,
          style,
        ]}
      />
    );
  }

  // Legacy path — body / heading / title / mono / caption.
  const finalSize = size ?? LEGACY_SIZE[variant];
  const useMono = mono || variant === "mono";
  const wantsTabular = numeric || useMono;
  return (
    <RNText
      {...rest}
      style={[
        {
          includeFontPadding: false,
          color: resolveTone(tone ?? "default"),
          fontSize: typography.size[finalSize],
          fontWeight: typography.weight[weight ?? "regular"] as
            | "400"
            | "500"
            | "600"
            | "700",
          fontFamily: useMono ? typography.familyMono : typography.family,
        },
        wantsTabular
          ? { fontVariant: ["tabular-nums"] as ["tabular-nums"] }
          : null,
        style,
      ]}
    />
  );
}

export const Text = memo(TextImpl);
