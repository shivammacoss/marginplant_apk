import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { PinDots } from "@shared/ui/PinDots";
import { GradientButton } from "@shared/ui/GradientButton";
import { usePinStore, PIN_LENGTH } from "@features/auth/store/pin.store";
import { useUiStore } from "@shared/store/ui.store";

export default function PinSetScreen() {
  const [stage, setStage] = useState<"enter" | "confirm">("enter");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const setStoredPin = usePinStore((s) => s.setPin);
  const pushToast = useUiStore((s) => s.pushToast);

  const current = stage === "enter" ? pin : confirm;
  const setCurrent = stage === "enter" ? setPin : setConfirm;

  useEffect(() => {
    // After the stage flips from "enter" → "confirm" we need to bring
    // the keyboard back. The TextInput is keyed on `stage` (see the
    // `key={stage}` below) so it FULLY REMOUNTS on transition — that
    // re-fires `autoFocus` and brings the soft keyboard up cleanly.
    // The setTimeout is the belt-and-suspenders for emulators where
    // autoFocus races the mount commit.
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [stage]);

  async function next() {
    if (stage === "enter" && pin.length === PIN_LENGTH) {
      setStage("confirm");
      return;
    }
    if (stage === "confirm" && confirm.length === PIN_LENGTH) {
      if (pin !== confirm) {
        pushToast({ kind: "error", message: "PINs do not match" });
        setConfirm("");
        return;
      }
      setBusy(true);
      try {
        await setStoredPin(pin);
        router.replace("/(tabs)");
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <Screen>
      <Header title="" back />
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={{ flex: 1, alignItems: "center", paddingTop: 64, gap: 28 }}
      >
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text tone="muted">{stage === "enter" ? "Create a 4-digit PIN" : "Confirm your PIN"}</Text>
          <Text style={{ fontSize: 26, fontWeight: "700" }}>
            {stage === "enter" ? "Set up your PIN" : "Re-enter PIN"}
          </Text>
        </View>
        <PinDots length={PIN_LENGTH} filled={current.length} cursorAt={current.length} />
        <TextInput
          // Key on `stage` so this TextInput is a fresh instance on the
          // "enter" → "confirm" transition. Without the key the same
          // mounted input retained its blur state from when we cleared
          // it and `autoFocus` would NOT re-fire (it only runs on
          // mount). Result: user saw the "Re-enter PIN" header with
          // dots + blinking cursor but no soft keyboard would appear
          // and they couldn't type — the bug shown in the screenshot.
          key={stage}
          ref={inputRef}
          value={current}
          onChangeText={(v) => {
            const cleaned = v.replace(/\D/g, "").slice(0, PIN_LENGTH);
            setCurrent(cleaned);
            // AUTO-ADVANCE the moment the user fills the 4th dot —
            // most users expected the form to move forward by itself
            // (Zerodha, GPay, every banking app does this). The old
            // flow required tapping a still-enabled "Continue" button
            // which the user thought was broken when they'd only
            // entered 3 digits but the button looked tappable.
            //   • stage="enter" + length=4 → flip to "confirm"
            //   • stage="confirm" + length=4 → run validation/save
            // Tiny setTimeout lets the dot fill animate one frame
            // before the stage transition (otherwise the user sees
            // an instant title change without seeing the 4th dot).
            if (cleaned.length === PIN_LENGTH) {
              setTimeout(() => {
                if (stage === "enter") {
                  setStage("confirm");
                } else {
                  void next();
                }
              }, 80);
            }
          }}
          keyboardType="number-pad"
          autoFocus
          caretHidden
          // `showSoftInputOnFocus` defaults to true; making it explicit
          // documents intent (some emulators / device skins flip the
          // default off if a global accessibility flag is set).
          showSoftInputOnFocus
          style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
        />
      </Pressable>
      <View style={{ paddingHorizontal: 4, paddingBottom: 16 }}>
        <GradientButton
          label={stage === "enter" ? "Continue" : "Set PIN"}
          loading={busy}
          disabled={current.length !== PIN_LENGTH}
          onPress={next}
        />
      </View>
    </Screen>
  );
}
