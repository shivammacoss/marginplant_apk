import { memo } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@shared/ui/Input";
import { GradientButton } from "@shared/ui/GradientButton";
import { Text } from "@shared/ui/Text";
import { colors, radii, spacing } from "@shared/theme";
import { registerSchema, type RegisterValues } from "@features/auth/schemas/auth.schema";
import { useRegister } from "@features/auth/hooks/useAuth";
import { useUiStore } from "@shared/store/ui.store";

// Mirror the password rules from auth.schema.ts (which mirrors the backend
// /auth/register validator). Keeping them in one list lets us render a live
// checklist under the password field so the user can see WHY a strong
// password is required — same pattern as Google / GitHub signup, fixes the
// "I typed 8 chars why is it failing" confusion that produced the silent
// 422 → "server error" toast loop.
const PASSWORD_RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "One uppercase letter (A–Z)", test: (v) => /[A-Z]/.test(v) },
  { label: "One lowercase letter (a–z)", test: (v) => /[a-z]/.test(v) },
  { label: "One digit (0–9)", test: (v) => /\d/.test(v) },
];

function PasswordChecklist({ value }: { value: string }) {
  // Stay hidden until the user starts typing so the form doesn't look
  // intimidating up-front — once they've touched it, walk them through
  // each rule in real time.
  if (!value) return null;
  return (
    <View
      style={{
        marginTop: spacing.xs,
        padding: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: colors.bgSurface,
        gap: 4,
      }}
    >
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <View
            key={rule.label}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons
              name={ok ? "checkmark-circle" : "ellipse-outline"}
              size={14}
              color={ok ? colors.buy : colors.textDim}
            />
            <Text
              size="sm"
              style={{
                color: ok ? colors.buy : colors.textMuted,
                fontWeight: ok ? "600" : "400",
              }}
            >
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function RegisterFormImpl() {
  const { control, handleSubmit } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: "", email: "", mobile: "", password: "", confirm: "" },
    mode: "onChange",
  });
  const passwordValue = useWatch({ control, name: "password" }) ?? "";
  const reg = useRegister();
  const pushToast = useUiStore((s) => s.pushToast);

  return (
    <View style={{ gap: 14 }}>
      <Controller
        control={control}
        name="full_name"
        render={({ field, fieldState }) => (
          <Input
            label="Full name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            placeholder="Rahul Sharma"
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <Input
            label="Email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            keyboardType="email-address"
            placeholder="you@example.com"
          />
        )}
      />
      <Controller
        control={control}
        name="mobile"
        render={({ field, fieldState }) => (
          <Input
            label="Mobile"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            keyboardType="phone-pad"
            maxLength={10}
            placeholder="98XXXXXXXX"
          />
        )}
      />
      <View>
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Input
              label="Password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              secureTextEntry
              placeholder="e.g. Vibhooti@123"
            />
          )}
        />
        <PasswordChecklist value={passwordValue} />
      </View>
      <Controller
        control={control}
        name="confirm"
        render={({ field, fieldState }) => (
          <Input
            label="Confirm password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            secureTextEntry
          />
        )}
      />
      <View style={{ marginTop: 8 }}>
        <GradientButton
          label="Create account"
          loading={reg.isPending}
          onPress={handleSubmit(
            (v) =>
              reg.mutate({
                email: v.email,
                mobile: v.mobile,
                password: v.password,
                full_name: v.full_name,
              }),
            // Surface a toast when validation fails — otherwise the user
            // taps "Create account" and nothing visible happens because
            // the offending field (usually Confirm-password) is below the
            // keyboard and they never see the inline error.
            (errors) => {
              const first =
                errors.full_name?.message ??
                errors.email?.message ??
                errors.mobile?.message ??
                errors.password?.message ??
                errors.confirm?.message ??
                "Please fill all fields correctly";
              pushToast({ kind: "error", message: String(first) });
            },
          )}
        />
      </View>
    </View>
  );
}

export const RegisterForm = memo(RegisterFormImpl);
