import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Input } from "@shared/ui/Input";
import { OtpInput } from "@shared/ui/OtpInput";
import { GradientButton } from "@shared/ui/GradientButton";
import { Text } from "@shared/ui/Text";
import { AuthHero } from "@features/auth/components/AuthHero";
import { AuthAPI } from "@features/auth/api/auth.api";
import { useUiStore } from "@shared/store/ui.store";
import { ApiError } from "@core/api/errors";

export default function OtpVerifyScreen() {
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const [otp, setOtp] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const pushToast = useUiStore((s) => s.pushToast);

  async function onSubmit() {
    if (otp.length !== 6 || newPwd.length < 8) return;
    setLoading(true);
    try {
      await AuthAPI.resetPassword({ identifier: identifier ?? "", otp, new_password: newPwd });
      pushToast({ kind: "success", message: "Password reset. Please sign in." });
      router.replace("/(auth)/login");
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
      <AuthHero title="Enter OTP" subtitle={`Sent to ${identifier ?? "your contact"}`} />
      <View style={{ gap: 18 }}>
        <OtpInput value={otp} onChange={setOtp} length={6} />
        <Input
          label="New password"
          value={newPwd}
          onChangeText={setNewPwd}
          secureTextEntry
          hint="Min 8 characters"
        />
        <View style={{ marginTop: 8 }}>
          <GradientButton
            label="Reset password"
            loading={loading}
            disabled={otp.length !== 6 || newPwd.length < 8}
            onPress={onSubmit}
          />
        </View>
        <View style={{ alignItems: "center", marginTop: 8 }}>
          <Text tone="muted">Didn't get the code? Try again in 30s</Text>
        </View>
      </View>
    </Screen>
  );
}
