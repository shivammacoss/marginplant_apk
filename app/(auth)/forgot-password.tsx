import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Input } from "@shared/ui/Input";
import { GradientButton } from "@shared/ui/GradientButton";
import { AuthHero } from "@features/auth/components/AuthHero";
import { AuthAPI } from "@features/auth/api/auth.api";
import { useUiStore } from "@shared/store/ui.store";
import { ApiError } from "@core/api/errors";

export default function ForgotPasswordScreen() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const pushToast = useUiStore((s) => s.pushToast);

  async function onSubmit() {
    if (!identifier) return;
    setLoading(true);
    try {
      await AuthAPI.forgotPassword(identifier);
      pushToast({ kind: "success", message: "OTP sent" });
      router.push({ pathname: "/(auth)/otp-verify", params: { identifier } });
    } catch (e) {
      const err = e as ApiError;
      pushToast({ kind: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Header title="" back />
      <AuthHero title="Forgot password?" subtitle="Enter your email or mobile" />
      <View style={{ gap: 16 }}>
        <Input
          label="Email or Mobile"
          value={identifier}
          onChangeText={setIdentifier}
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <View style={{ marginTop: 8 }}>
          <GradientButton
            label="Send OTP"
            loading={loading}
            disabled={!identifier}
            onPress={onSubmit}
          />
        </View>
      </View>
    </Screen>
  );
}
