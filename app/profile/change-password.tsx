import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Input } from "@shared/ui/Input";
import { Text } from "@shared/ui/Text";
import { GradientButton } from "@shared/ui/GradientButton";
import { colors, spacing } from "@shared/theme";
import { useUiStore } from "@shared/store/ui.store";
import { useChangePassword } from "@features/auth/hooks/useAuth";

interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

function scorePassword(pw: string): Strength {
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (pw.length >= 8) score = (score + 1) as Strength["score"];
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score = (score + 1) as Strength["score"];
  if (/\d/.test(pw)) score = (score + 1) as Strength["score"];
  if (/[^A-Za-z0-9]/.test(pw)) score = (score + 1) as Strength["score"];
  const map: Record<Strength["score"], { label: string; color: string }> = {
    0: { label: "Too weak", color: colors.sell },
    1: { label: "Weak", color: colors.sell },
    2: { label: "Okay", color: colors.warn },
    3: { label: "Strong", color: colors.buy },
    4: { label: "Excellent", color: colors.buy },
  };
  return { score, ...map[score] };
}

export default function ChangePasswordScreen() {
  const change = useChangePassword();
  const pushToast = useUiStore((s) => s.pushToast);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const strength = useMemo(() => scorePassword(newPw), [newPw]);
  const mismatch = confirmPw.length > 0 && newPw !== confirmPw;
  const canSubmit =
    currentPw.length > 0 &&
    newPw.length >= 8 &&
    newPw === confirmPw &&
    !change.isPending;

  function submit() {
    if (!currentPw) {
      pushToast({ kind: "warn", message: "Enter your current password" });
      return;
    }
    if (newPw.length < 8) {
      pushToast({ kind: "warn", message: "New password must be at least 8 characters" });
      return;
    }
    if (newPw !== confirmPw) {
      pushToast({ kind: "warn", message: "Passwords do not match" });
      return;
    }
    if (newPw === currentPw) {
      pushToast({ kind: "warn", message: "New password must be different" });
      return;
    }
    change.mutate({ current_password: currentPw, new_password: newPw });
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Header title="Change password" back />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing["3xl"],
            paddingTop: spacing.md,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text tone="muted" size="sm" style={{ marginBottom: spacing.lg }}>
            Pick something at least 8 characters long. Mix letters, digits and a symbol for a
            stronger password.
          </Text>

          <View style={{ gap: spacing.md }}>
            <Input
              label="Current password"
              value={currentPw}
              onChangeText={setCurrentPw}
              secureTextEntry
              placeholder="Enter current password"
              textContentType="password"
            />
            <Input
              label="New password"
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry
              placeholder="At least 8 characters"
              textContentType="newPassword"
              hint={newPw.length > 0 ? undefined : "Min 8 characters"}
            />
            {newPw.length > 0 ? (
              <View style={{ marginTop: -4 }}>
                <View
                  style={{
                    flexDirection: "row",
                    height: 4,
                    borderRadius: 2,
                    overflow: "hidden",
                    backgroundColor: colors.bgElevated,
                  }}
                >
                  {Array.from({ length: 4 }).map((_, i) => (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        marginRight: i < 3 ? 2 : 0,
                        backgroundColor:
                          i < strength.score ? strength.color : "transparent",
                      }}
                    />
                  ))}
                </View>
                <Text
                  size="xs"
                  style={{
                    color: strength.color,
                    marginTop: 4,
                    marginLeft: 4,
                    fontWeight: "600",
                  }}
                >
                  {strength.label}
                </Text>
              </View>
            ) : null}

            <Input
              label="Confirm new password"
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry
              placeholder="Re-enter new password"
              textContentType="newPassword"
              error={mismatch ? "Passwords don't match" : undefined}
            />
          </View>

          <View style={{ marginTop: spacing.xl }}>
            <GradientButton
              label={change.isPending ? "Updating…" : "Update password"}
              disabled={!canSubmit}
              loading={change.isPending}
              onPress={submit}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
