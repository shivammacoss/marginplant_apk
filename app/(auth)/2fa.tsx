import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { OtpInput } from "@shared/ui/OtpInput";
import { GradientButton } from "@shared/ui/GradientButton";
import { AuthHero } from "@features/auth/components/AuthHero";

export default function TwoFactorScreen() {
  const [code, setCode] = useState("");
  return (
    <Screen>
      <Header title="" back />
      <AuthHero title="Two-factor auth" subtitle="Enter the 6-digit code from your authenticator" />
      <View style={{ gap: 18 }}>
        <OtpInput value={code} onChange={setCode} length={6} />
        <View style={{ marginTop: 8 }}>
          <GradientButton
            label="Verify"
            disabled={code.length !== 6}
            onPress={() => router.replace("/(tabs)")}
          />
        </View>
        <View style={{ alignItems: "center" }}>
          <Text tone="muted">Optional — skip if not enabled on your account</Text>
        </View>
      </View>
    </Screen>
  );
}
