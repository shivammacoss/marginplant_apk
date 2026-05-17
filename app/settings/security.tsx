import { Alert, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { Row } from "@shared/ui/Row";
import { Toggle } from "@shared/ui/Toggle";
import { colors } from "@shared/theme";
import { usePinStore } from "@features/auth/store/pin.store";
import { useBiometric } from "@shared/hooks/useBiometric";
import { useUiStore } from "@shared/store/ui.store";

export default function SecurityScreen() {
  const bioEnabled = usePinStore((s) => s.biometricEnabled);
  const hasPin = usePinStore((s) => s.hasPin);
  const setBio = usePinStore((s) => s.setBiometricEnabled);
  const clearPin = usePinStore((s) => s.clearPin);
  const { supported, prompt } = useBiometric();
  const pushToast = useUiStore((s) => s.pushToast);

  async function toggleBio(next: boolean) {
    if (next && !supported) {
      pushToast({ kind: "warn", message: "Biometric not available on this device" });
      return;
    }
    if (next && !hasPin) {
      // Biometric without a PIN fallback is risky — if the fingerprint
      // sensor stops recognising the user (wet finger, broken sensor)
      // they'd be locked out with no recovery on this device. Require
      // a PIN first.
      pushToast({
        kind: "warn",
        message: "Set a PIN first — biometric uses it as fallback.",
      });
      return;
    }
    if (next) {
      const ok = await prompt("Enable biometric login");
      if (!ok) return;
    }
    setBio(next);
  }

  function confirmRemovePin() {
    Alert.alert(
      "Remove PIN?",
      "Turning off the PIN will also disable biometric login. You'll go straight to the app on launch.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await clearPin();
            pushToast({
              kind: "success",
              message: "PIN lock disabled",
            });
          },
        },
      ],
    );
  }

  function confirmFreeze() {
    Alert.alert(
      "Freeze account?",
      "This pauses trading and withdrawals until you contact support.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Freeze",
          style: "destructive",
          onPress: () => pushToast({ kind: "info", message: "Freeze request submitted" }),
        },
      ],
    );
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16 }}>
        <Header title="Security" back />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
          }}
        >
          <Row
            icon="finger-print-outline"
            title="Biometric login"
            subtitle={supported ? "Unlock with Face ID / fingerprint" : "Not available on this device"}
            chevron={false}
            divider
            rightNode={
              <Toggle
                value={bioEnabled}
                onChange={toggleBio}
                disabled={!supported || !hasPin}
              />
            }
          />
          <Row
            icon="keypad-outline"
            title={hasPin ? "Change PIN" : "Set up PIN"}
            subtitle={
              hasPin
                ? "Tap to set a new 4-digit PIN"
                : "Add a PIN lock to secure the app"
            }
            divider
            onPress={() => router.push("/(auth)/pin-set")}
          />
          {hasPin ? (
            <Row
              icon="lock-open-outline"
              title="Remove PIN"
              subtitle="Turn off PIN + biometric lock"
              divider
              onPress={confirmRemovePin}
            />
          ) : null}
          <Row
            icon="lock-closed-outline"
            title="Login sessions"
            subtitle="Active devices and recent logins"
          />
        </View>

        <Text tone="muted" size="xs" style={{ marginTop: 4, paddingHorizontal: 4 }}>
          DANGER ZONE
        </Text>
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
          }}
        >
          <Row
            icon="snow-outline"
            title="Freeze account"
            subtitle="Temporarily pause trading and withdrawals"
            onPress={confirmFreeze}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
