import { Appearance } from "react-native";
import { create } from "zustand";
import { mmkv } from "@core/storage/mmkv";
import { STORAGE_KEYS } from "@core/storage/keys";
import {
  applyPalette,
  darkPalette,
  lightPalette,
  type Palette,
} from "@shared/theme/colors";

export type ThemeMode = "dark" | "light" | "system";

interface ThemeState {
  mode: ThemeMode;
  resolved: "dark" | "light";
  hydrated: boolean;
  /**
   * Monotonic counter bumped on every EXPLICIT user theme switch and on
   * every Appearance change after hydration. Screens key off this so a
   * theme flip force-remounts the screen tree and every component re-
   * reads `colors.*` from the freshly-mutated palette. Without this,
   * components that captured `colors.bg` at module-load time (or in a
   * useMemo with no theme dep) keep painting the OLD palette — that's
   * the "Light mode set kiya but pages dark hi rendering kar rhe" bug.
   * Stays at 0 during the initial hydrate so cold boot doesn't trigger
   * a spurious remount.
   */
  themeNonce: number;
  setMode: (mode: ThemeMode) => void;
  hydrate: () => void;
}

function resolveMode(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    const sys = Appearance.getColorScheme();
    return sys === "light" ? "light" : "dark";
  }
  return mode;
}

function paletteFor(resolved: "dark" | "light"): Palette {
  return resolved === "light" ? lightPalette : darkPalette;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "dark",
  resolved: "dark",
  hydrated: false,
  themeNonce: 0,

  setMode: (mode) => {
    const resolved = resolveMode(mode);
    applyPalette(paletteFor(resolved));
    mmkv.setString(STORAGE_KEYS.theme, mode);
    // Bump the nonce so screen-tree subscribers force-remount and
    // re-read the freshly-mutated `colors` singleton.
    set({ mode, resolved, themeNonce: get().themeNonce + 1 });
  },

  hydrate: () => {
    if (get().hydrated) return;
    const stored = (mmkv.getString(STORAGE_KEYS.theme) ?? "dark") as ThemeMode;
    const mode: ThemeMode = stored === "light" || stored === "system" ? stored : "dark";
    const resolved = resolveMode(mode);
    applyPalette(paletteFor(resolved));
    // DO NOT bump themeNonce on hydrate — cold boot painting matches
    // the resolved palette by definition, and bumping here would
    // remount the screen tree on every app launch.
    set({ mode, resolved, hydrated: true });
  },
}));

Appearance.addChangeListener(() => {
  const s = useThemeStore.getState();
  if (s.mode !== "system") return;
  const resolved = resolveMode("system");
  // Bail when nothing actually changed — Android can fire this listener
  // multiple times during boot with the same color scheme, and an
  // unconditional setState used to bounce the Stack key and remount the
  // login screen. Only mutate when the value flips.
  if (resolved === s.resolved) return;
  applyPalette(paletteFor(resolved));
  // OS auto-theme flip → bump nonce so screens repaint with the new
  // palette. Only fires when `resolved` actually changed (guard above).
  useThemeStore.setState({ resolved, themeNonce: s.themeNonce + 1 });
});
