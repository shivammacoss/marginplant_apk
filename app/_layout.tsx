import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { AppProviders } from "@core/providers/AppProviders";
import { ErrorBoundary } from "@shared/components/ErrorBoundary";
import { bootstrapStorage } from "@core/storage/mmkv";
import { useThemeStore } from "@shared/store/theme.store";
import { preloadBiometricCapability } from "@core/security/biometric";
import { colors } from "@shared/theme";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  // Subscribe to the theme nonce so a user-initiated theme flip
  // (Settings → Theme) or an OS auto-theme change forces a Stack
  // remount and every screen re-reads the updated `colors` singleton.
  // Cold boot keeps nonce at 0 so this doesn't fire spuriously.
  const themeNonce = useThemeStore((s) => s.themeNonce);

  useEffect(() => {
    // Warm the biometric-capability cache while storage bootstraps.
    // hasHardwareAsync + isEnrolledAsync + supportedAuthenticationTypesAsync
    // each take ~50-150 ms on Android — running them now in parallel
    // means the pin-enter screen's auto-prompt sees a synchronous answer
    // and fires the fingerprint UI in one render frame, not after a
    // 300+ ms three-bridge-call cascade.
    preloadBiometricCapability();
    void bootstrapStorage().then(() => {
      hydrateTheme();
      setReady(true);
    });
    // Trade-action tones are intentionally NOT preloaded here anymore.
    // Previously we kicked off three CDN fetches (Pixabay MP3s) on every
    // cold boot — in a release APK on a slow connection that blocked the
    // JS thread for seconds and produced the "login page bar bar load le
    // raha hai" symptom. Sounds now load lazily inside `sounds.play()`
    // the first time the user actually places a trade; the auth screens
    // never pay that cost.
  }, [hydrateTheme]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    // Providers stay mounted (no key) so the auth session, WS, query
    // cache, etc. survive a theme flip. ONLY the Stack remounts via
    // `key={themeNonce}` so every screen re-renders against the freshly
    // mutated `colors` palette. The nonce stays at 0 during initial
    // hydration so cold boot doesn't trigger a wasteful remount.
    <AppProviders>
      <ErrorBoundary>
        <Stack
          key={themeNonce}
          screenOptions={{
            headerShown: false,
            // Native fast slide on push — "fade" was a 300 ms cross-fade
            // that felt like a load spinner. Slide animation is ~180 ms
            // and feels instant.
            animation: "slide_from_right",
            animationDuration: 180,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </ErrorBoundary>
    </AppProviders>
  );
}
