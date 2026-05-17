import { useEffect } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuthStore } from "@features/auth/store/auth.store";
import { usePinStore } from "@features/auth/store/pin.store";
import { colors } from "@shared/theme";

// Gate logic on app launch:
//   - Not authenticated         → /(auth)/login
//   - Authenticated + PIN set   → /(auth)/pin-enter (auto-prompts biometric
//                                  if user enabled it in settings)
//   - Authenticated + biometric → /(auth)/pin-enter (biometric-only path —
//                                  the screen still accepts PIN if hasPin)
//   - Otherwise                 → /(tabs)
// Forcing a fresh PIN setup at startup is intentionally not part of this
// flow — that screen is reachable from Settings → Change PIN when the user
// chooses to enable the feature.
export default function Splash() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const hasPin = usePinStore((s) => s.hasPin);
  const unlocked = usePinStore((s) => s.unlocked);
  const bioEnabled = usePinStore((s) => s.biometricEnabled);
  const hydratePin = usePinStore((s) => s.hydrate);

  // Run hydrates exactly once on mount. Previously we ran them every time
  // `hydrated` flipped, which (combined with the now-removed Stack key) made
  // the redirect chain re-evaluate and the login screen look like it was
  // refreshing as zustand state landed in two passes.
  useEffect(() => {
    hydrate();
    void hydratePin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hydrated) {
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

  if (!isAuth) return <Redirect href="/(auth)/login" />;

  // Lock the app only when the user has actively opted in (PIN set OR
  // biometric enabled). pin-enter.tsx auto-fires the biometric prompt on
  // mount whenever biometricEnabled is true, so the same screen handles
  // both lock modes.
  const needsUnlock = (hasPin || bioEnabled) && !unlocked;
  if (needsUnlock) return <Redirect href="/(auth)/pin-enter" />;

  return <Redirect href="/(tabs)" />;
}
