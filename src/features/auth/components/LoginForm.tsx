import { memo } from "react";
import { View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@shared/ui/Input";
import { GradientButton } from "@shared/ui/GradientButton";
import { loginSchema, type LoginValues } from "@features/auth/schemas/auth.schema";
import { useLogin } from "@features/auth/hooks/useAuth";

function LoginFormImpl() {
  const { control, handleSubmit } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
    mode: "onChange",
  });
  const login = useLogin();

  return (
    <View style={{ gap: 16 }}>
      <Controller
        control={control}
        name="identifier"
        render={({ field, fieldState }) => (
          <Input
            label="Email or Mobile"
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
        name="password"
        render={({ field, fieldState }) => (
          <Input
            label="Password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            secureTextEntry
            placeholder="••••••••"
          />
        )}
      />
      <View style={{ marginTop: 8 }}>
        <GradientButton
          label="Sign in"
          loading={login.isPending}
          onPress={handleSubmit((v) => login.mutate(v))}
        />
      </View>
    </View>
  );
}

export const LoginForm = memo(LoginFormImpl);
