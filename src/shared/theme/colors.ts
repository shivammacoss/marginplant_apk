export interface Palette {
  bg: string;
  bgElevated: string;
  bgSurface: string;
  bgChip: string;
  bgOverlay: string;

  border: string;
  borderStrong: string;

  text: string;
  textMuted: string;
  textDim: string;
  textInverse: string;

  buy: string;
  buyDim: string;
  sell: string;
  sellDim: string;

  warn: string;
  info: string;
  ok: string;
  danger: string;

  primary: string;
  primaryPressed: string;
  // Tinted background tone matching `primary`. Used for chips / buttons
  // that need a subtle primary-coloured fill (e.g. the SL/TP action pill
  // on the open-position row). Same relationship as buyDim ↔ buy.
  primaryDim: string;

  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;

  avatarTeal: string;

  shimmer: string;
  flashUp: string;
  flashDown: string;
}

export const darkPalette: Palette = {
  bg: "#0d0d0d",
  bgElevated: "#1a1a1a",
  bgSurface: "#262626",
  bgChip: "#1f1f1f",
  bgOverlay: "rgba(0,0,0,0.7)",

  border: "#2a2a2a",
  borderStrong: "#3a3a3a",

  text: "#FAFAFA",
  textMuted: "#A1A1AA",
  textDim: "#71717A",
  textInverse: "#0d0d0d",

  buy: "#2DD4BF",
  buyDim: "#0F766E",
  sell: "#FB7185",
  sellDim: "#9F1239",

  warn: "#F59E0B",
  info: "#60A5FA",
  ok: "#2DD4BF",
  danger: "#FB7185",

  primary: "#A855F7",
  primaryPressed: "#7E22CE",
  primaryDim: "#4C1D95",

  gradientFrom: "#8B5CF6",
  gradientVia: "#EC4899",
  gradientTo: "#F97316",

  avatarTeal: "#0E7490",

  shimmer: "#202020",
  flashUp: "rgba(45,212,191,0.18)",
  flashDown: "rgba(251,113,133,0.18)",
};

export const lightPalette: Palette = {
  bg: "#FFFFFF",
  bgElevated: "#F4F4F5",
  bgSurface: "#E4E4E7",
  bgChip: "#F4F4F5",
  bgOverlay: "rgba(0,0,0,0.45)",

  border: "#E4E4E7",
  borderStrong: "#D4D4D8",

  text: "#0d0d0d",
  textMuted: "#52525B",
  textDim: "#71717A",
  textInverse: "#FFFFFF",

  buy: "#0F766E",
  buyDim: "#99F6E4",
  sell: "#E11D48",
  sellDim: "#FECDD3",

  warn: "#B45309",
  info: "#1D4ED8",
  ok: "#0F766E",
  danger: "#E11D48",

  primary: "#7C3AED",
  primaryPressed: "#5B21B6",
  primaryDim: "#EDE9FE",

  gradientFrom: "#7C3AED",
  gradientVia: "#DB2777",
  gradientTo: "#EA580C",

  avatarTeal: "#0E7490",

  shimmer: "#E4E4E7",
  flashUp: "rgba(15,118,110,0.14)",
  flashDown: "rgba(225,29,72,0.14)",
};

export const colors: Palette = { ...darkPalette };

export function applyPalette(p: Palette): void {
  Object.assign(colors, p);
}

export type ColorToken = keyof Palette;
