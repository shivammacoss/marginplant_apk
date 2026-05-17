import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { Text } from "@shared/ui/Text";
import { PinDots } from "@shared/ui/PinDots";
import { GradientButton } from "@shared/ui/GradientButton";
import { BiometricButton } from "@features/auth/components/BiometricButton";
import { usePinStore, PIN_LENGTH } from "@features/auth/store/pin.store";
import { useAuthStore } from "@features/auth/store/auth.store";
import { useUiStore } from "@shared/store/ui.store";
import { useBiometric } from "@shared/hooks/useBiometric";
import { colors } from "@shared/theme";

export default function PinEnterScreen() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const user = useAuthStore((s) => s.user);
  const verifyPin = usePinStore((s) => s.verifyPin);
  const bioEnabled = usePinStore((s) => s.biometricEnabled);
  const setBioEnabled = usePinStore((s) => s.setBiometricEnabled);
  const pushToast = useUiStore((s) => s.pushToast);
  const { supported, prompt } = useBiometric();

  async function tryBiometric() {
    if (!supported) return;
    const ok = await prompt("Unlock MarginPlant");
    if (ok) {
      usePinStore.getState().setUnlocked(true);
      router.replace("/(tabs)");
    }
  }

  useEffect(() => {
    if (supported && bioEnabled) void tryBiometric();
  }, [supported, bioEnabled]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  async function submit() {
    if (pin.length !== PIN_LENGTH) return;
    setBusy(true);
    const ok = await verifyPin(pin);
    setBusy(false);
    if (ok) router.replace("/(tabs)");
    else {
      pushToast({ kind: "error", message: "Incorrect PIN" });
      setPin("");
    }
  }

  return (
    <Screen>
      <View style={{ alignItems: "flex-end" }}>
        <Pressable hitSlop={10} onPress={() => useAuthStore.getState().signOut()}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
        </Pressable>
      </View>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={{ alignItems: "center", paddingTop: 56, gap: 28 }}
      >
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text tone="muted">Hey {user?.full_name?.split(" ")[0]?.toUpperCase() ?? "Trader"}</Text>
          <Text style={{ fontSize: 28, fontWeight: "700" }}>Enter your PIN</Text>
        </View>
        <PinDots length={PIN_LENGTH} filled={pin.length} cursorAt={pin.length} />
        <TextInput
          ref={inputRef}
          value={pin}
          onChangeText={(v) => {
            const next = v.replace(/\D/g, "").slice(0, PIN_LENGTH);
            setPin(next);
            if (next.length === PIN_LENGTH) setTimeout(submit, 80);
          }}
          keyboardType="number-pad"
          autoFocus
          caretHidden
          style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
        />
        <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
          <Text style={{ textDecorationLine: "underline", fontWeight: "500" }}>Forgot PIN</Text>
        </Pressable>
      </Pressable>
      <View style={{ flex: 1 }} />
      {supported ? (
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <BiometricButton
            onPress={async () => {
              const ok = await prompt("Unlock MarginPlant");
              if (ok) {
                setBioEnabled(true);
                usePinStore.getState().setUnlocked(true);
                router.replace("/(tabs)");
              }
            }}
            label={bioEnabled ? "Use biometric" : "Enable biometric"}
          />
        </View>
      ) : null}
      <View style={{ paddingBottom: 8 }}>
        <GradientButton
          label="Proceed"
          loading={busy}
          disabled={pin.length !== PIN_LENGTH}
          onPress={submit}
        />
      </View>
    </Screen>
  );
}
