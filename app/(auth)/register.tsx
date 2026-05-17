import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { AuthHero } from "@features/auth/components/AuthHero";
import { RegisterForm } from "@features/auth/components/RegisterForm";

// Register form has 5 inputs + button + footer link — taller than a phone
// once the numeric keyboard opens for the Mobile field. On Android we rely
// on `softwareKeyboardLayoutMode: "resize"` (app.json) to shrink the host
// view, and the ScrollView (with explicit flex:1 + flexGrow:1 content) to
// overflow scroll. KeyboardAvoidingView is iOS-only — on Android it was
// previously a no-op wrapper, and adding `behavior="height"` here would
// fight the OS resize and double-shrink the layout.
//
// The generous bottom padding ensures the last field (Confirm password) +
// the Create-account button stay reachable above the keyboard even on
// short screens / large keyboards (MIUI emoji keyboard ~ 380px).
export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const body = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingBottom: Math.max(insets.bottom, 24) + 280,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <AuthHero title="Create account" subtitle="Start trading in minutes" />
      <RegisterForm />
      <View style={{ marginTop: 20, alignItems: "center" }}>
        <Pressable
          onPress={() => router.push("/(auth)/login")}
          hitSlop={10}
          style={{ flexDirection: "row", gap: 4 }}
        >
          <Text tone="muted">Already have an account?</Text>
          <Text style={{ color: "#A855F7", fontWeight: "500" }}>Sign in</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  return (
    <Screen>
      <Header title="" back />
      {Platform.OS === "ios" ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </Screen>
  );
}
