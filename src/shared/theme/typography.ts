import { Platform, type TextStyle } from "react-native";

// ── Font family ──────────────────────────────────────────────────────
// Goal: ChatGPT / Linear / Zerodha-grade type. Inter is the target, but
// shipping an EAS-built TTF would block the OTA-only update flow the
// user relies on. Instead we prefer Inter when present (admins can later
// register it via expo-font + an EAS build), and fall back to each
// platform's modern UI font: SF Pro on iOS and Roboto on Android. Both
// fallbacks are visually within a hair of Inter — same metrics, same
// open shapes — so the upgrade is dominated by tabular numerics +
// letter-spacing + weight hierarchy, not the glyph swap itself.
const family = Platform.select({
  // "System" resolves to SF Pro Text / Display on iOS 13+ — Apple's own
  // Inter-equivalent. No risk of an unknown-font fallback chain.
  ios: "System",
  // Roboto is the default Android UI font; explicit `sans-serif` keeps
  // RN from sometimes resolving to Noto Sans on AOSP builds where the
  // default has been swapped.
  android: "sans-serif",
  default: "System",
}) as string;

// Roboto Mono / SF Mono — used for any text we want to render in
// monospace AS A STYLE (rare). The numeric-tabular path below is the
// preferred way to get aligned digits without switching font families.
const familyMono = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
}) as string;

// ── Type scale ───────────────────────────────────────────────────────
// Slightly tighter than the previous scale — modern fintech UIs (Groww,
// Robinhood, Zerodha Kite Next) use 11/12/14/16 for the bulk of the UI
// with 18-30 reserved for screen titles. This matches that rhythm.
const size = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  "2xl": 20,
  "3xl": 24,
  "4xl": 30,
} as const;

const weight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

const lineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

// ── Reusable variant tokens ──────────────────────────────────────────
// Each token is a fully-formed `TextStyle` you can spread into any RN
// `<Text>` component, or pass through the shared `Text` UI primitive via
// its `variant` prop. Keeping them as `TextStyle` (not class names) lets
// callers compose them with one-off overrides without a className parser.
//
// Numeric-flavoured variants enable `fontVariant: ['tabular-nums']` —
// that's the single highest-impact change for a "premium fintech feel":
// digits become same-width so prices, P&L and quantities stop wobbling
// as values change.
//
// Naming maps 1:1 to the user-requested tokens:
//   heading / subheading / body / caption
//   numericValue / pnlPositive / pnlNegative / labelMuted
const variants = {
  // Top-of-screen titles — Portfolio / Orders / Position headings.
  heading: {
    fontFamily: family,
    fontSize: size["2xl"],
    fontWeight: weight.bold,
    lineHeight: size["2xl"] * lineHeight.tight,
    letterSpacing: -0.2,
  } satisfies TextStyle,

  // Section headers inside a screen — "OPEN POSITIONS · 2".
  subheading: {
    fontFamily: family,
    fontSize: size.md,
    fontWeight: weight.semibold,
    lineHeight: size.md * lineHeight.normal,
    letterSpacing: 0.1,
  } satisfies TextStyle,

  // Default body copy — instrument names, descriptions, row text.
  body: {
    fontFamily: family,
    fontSize: size.md,
    fontWeight: weight.regular,
    lineHeight: size.md * lineHeight.normal,
  } satisfies TextStyle,

  // Helper / footnote text — opened-at timestamps, segment tags.
  caption: {
    fontFamily: family,
    fontSize: size.xs,
    fontWeight: weight.medium,
    lineHeight: size.xs * lineHeight.normal,
  } satisfies TextStyle,

  // ── Numeric variants (tabular nums) ──────────────────────────────
  // Use for prices, balances, P&L, quantities, lots, charts axis labels.
  // `fontVariant: ['tabular-nums']` is supported on iOS 9.0+ and Android
  // API 26+ via RN's TextStyle. Combined with `bold` weight this matches
  // the ChatGPT / Groww / Robinhood numeric look — fixed-width digits,
  // strong vertical rhythm.
  numericValue: {
    fontFamily: family,
    fontSize: size.md,
    fontWeight: weight.bold,
    fontVariant: ["tabular-nums"],
    lineHeight: size.md * lineHeight.tight,
  } satisfies TextStyle,

  pnlPositive: {
    fontFamily: family,
    fontSize: size.md,
    fontWeight: weight.bold,
    fontVariant: ["tabular-nums"],
    lineHeight: size.md * lineHeight.tight,
    // colour applied at consumption site via `tone="buy"` so the same
    // weight + spacing pair works on every theme palette.
  } satisfies TextStyle,

  pnlNegative: {
    fontFamily: family,
    fontSize: size.md,
    fontWeight: weight.bold,
    fontVariant: ["tabular-nums"],
    lineHeight: size.md * lineHeight.tight,
  } satisfies TextStyle,

  // Uppercase muted labels — "ENTRY", "BID", "MARGIN USED".
  labelMuted: {
    fontFamily: family,
    fontSize: 10,
    fontWeight: weight.semibold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    lineHeight: 12,
  } satisfies TextStyle,
} as const;

export type TypographyVariant = keyof typeof variants;

export const typography = {
  family,
  familyMono,
  size,
  weight,
  lineHeight,
  variants,
} as const;

export type FontSize = keyof typeof typography.size;
export type FontWeight = keyof typeof typography.weight;
