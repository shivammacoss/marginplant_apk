import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Avatar } from "@shared/ui/Avatar";
import { Text } from "@shared/ui/Text";
import { Input } from "@shared/ui/Input";
import { GradientButton } from "@shared/ui/GradientButton";
import { colors, radii, spacing } from "@shared/theme";
import { useAuthStore } from "@features/auth/store/auth.store";
import { useUpdateProfile } from "@features/auth/hooks/useAuth";

// Email + mobile aren't editable via the public backend contract
// (`PUT /user/users/me` only accepts `full_name`, `photo_url`, `communication`,
// `kyc`). Render them read-only and direct the user to support to change them.
export default function AccountDetails() {
  const user = useAuthStore((s) => s.user);
  const update = useUpdateProfile();

  const [fullName, setFullName] = useState(user?.full_name ?? "");

  const trimmed = fullName.trim();
  const dirty = trimmed.length >= 2 && trimmed !== user?.full_name;

  function save() {
    if (!dirty) return;
    update.mutate({ full_name: trimmed });
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Header title="Account details" back />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing["3xl"],
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", marginTop: spacing.md, marginBottom: spacing.lg }}>
            <Avatar name={fullName || user?.full_name} size={92} />
            {user?.user_code ? (
              <Text tone="muted" size="xs" style={{ marginTop: 8 }}>
                {user.user_code}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: spacing.md }}>
            <Input
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Your full name"
              maxLength={128}
            />

            <ReadOnlyField label="Email" value={user?.email ?? "—"} icon="mail-outline" />
            <ReadOnlyField label="Mobile" value={user?.mobile ?? "—"} icon="call-outline" />
            {user?.pan ? (
              <ReadOnlyField label="PAN" value={user.pan} icon="card-outline" />
            ) : null}
            <ReadOnlyField
              label="KYC status"
              value={user?.kyc_status ?? "PENDING"}
              icon="shield-checkmark-outline"
            />

            <Pressable onPress={() => router.push("/profile/change-password")}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.bgElevated,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 14,
                  marginTop: spacing.sm,
                }}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={colors.text}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600" }}>Change password</Text>
                  <Text tone="dim" size="xs" style={{ marginTop: 2 }}>
                    Use your current password to set a new one
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
              </View>
            </Pressable>

            <Text tone="dim" size="xs" style={{ marginTop: 4, paddingHorizontal: 4 }}>
              Email and mobile can't be changed from the app. Contact support to update them.
            </Text>
          </View>

          <View style={{ marginTop: spacing.xl }}>
            <GradientButton
              label={update.isPending ? "Saving…" : "Save changes"}
              disabled={!dirty || update.isPending}
              loading={update.isPending}
              onPress={save}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ReadOnlyField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View>
      <Text tone="muted" size="sm" style={{ marginLeft: 4, marginBottom: 4 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.bgElevated,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: 14,
          opacity: 0.85,
        }}
      >
        <Ionicons name={icon} size={16} color={colors.textMuted} style={{ marginRight: 10 }} />
        <Text style={{ flex: 1, fontSize: 15 }}>{value}</Text>
        <Ionicons name="lock-closed" size={12} color={colors.textDim} />
      </View>
    </View>
  );
}
