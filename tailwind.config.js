/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0d0d0d",
          elevated: "#1a1a1a",
          surface: "#262626",
          chip: "#1f1f1f",
          overlay: "rgba(0,0,0,0.7)",
        },
        border: {
          DEFAULT: "#2a2a2a",
          strong: "#3a3a3a",
        },
        text: {
          DEFAULT: "#FAFAFA",
          muted: "#A1A1AA",
          dim: "#71717A",
          inverse: "#0d0d0d",
        },
        buy: { DEFAULT: "#2DD4BF", dim: "#0F766E" },
        sell: { DEFAULT: "#FB7185", dim: "#9F1239" },
        warn: "#F59E0B",
        info: "#60A5FA",
        primary: { DEFAULT: "#A855F7", pressed: "#7E22CE" },
        grad: {
          from: "#8B5CF6",
          via: "#EC4899",
          to: "#F97316",
        },
        avatarTeal: "#0E7490",
      },
      fontFamily: {
        sans: ["System"],
        mono: ["monospace"],
      },
      borderRadius: {
        none: "0",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
        "3xl": "28px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};
