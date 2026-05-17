import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  AuthAPI,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
} from "@features/auth/api/auth.api";
import { useAuthStore } from "@features/auth/store/auth.store";
import { usePinStore } from "@features/auth/store/pin.store";
import { ApiError } from "@core/api/errors";
import { useUiStore } from "@shared/store/ui.store";

// PIN-gate after login is currently disabled — flip this back to true (and
// the matching flag in app/index.tsx) when the feature is re-enabled.
const PIN_GATE_ENABLED = false;

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: async (body: LoginInput) => {
      const res = await AuthAPI.login(body);
      await setSession(res.user, res.access_token, res.refresh_token);
      return res.user;
    },
    onSuccess: () => {
      // PIN hydration is fire-and-forget — only the (currently disabled)
      // PIN-gate branch reads it, and even there we'd rather navigate
      // immediately than block on AsyncStorage. Saves ~30-80ms on login.
      void usePinStore.getState().hydrate();
      if (PIN_GATE_ENABLED) {
        const hasPin = usePinStore.getState().hasPin;
        router.replace(hasPin ? "/(auth)/pin-enter" : "/(auth)/pin-set");
        return;
      }
      router.replace("/(tabs)");
    },
    onError: (e: ApiError) => pushToast({ kind: "error", message: e.message }),
  });
}

export function useRegister() {
  const pushToast = useUiStore((s) => s.pushToast);
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    // Register + auto-login in one mutation — user goes straight to the
    // tabs after submitting the form, never sees the login screen again.
    // We hold on to the password from the register payload so we can hand
    // it to AuthAPI.login immediately. If the auto-login leg fails (rare —
    // typically only if the freshly-created account is somehow blocked),
    // we fall back to bouncing them to /(auth)/login with the error.
    mutationFn: async (body: RegisterInput) => {
      await AuthAPI.register(body);
      const session = await AuthAPI.login({
        identifier: body.email,
        password: body.password,
      });
      await setSession(session.user, session.access_token, session.refresh_token);
      return session.user;
    },
    onSuccess: () => {
      pushToast({ kind: "success", message: "Welcome to MarginPlant" });
      router.replace("/(tabs)");
    },
    onError: (e: ApiError) => pushToast({ kind: "error", message: e.message }),
  });
}

export function useLogout() {
  const signOut = useAuthStore((s) => s.signOut);
  const clearPin = usePinStore((s) => s.clearPin);
  return useMutation({
    mutationFn: async () => {
      await AuthAPI.logout().catch(() => null);
      await clearPin();
      await signOut();
    },
    onSuccess: () => router.replace("/(auth)/login"),
  });
}

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (body: UpdateProfileInput) => AuthAPI.updateProfile(body),
    onSuccess: (user) => {
      setUser(user);
      pushToast({ kind: "success", message: "Profile updated" });
    },
    onError: (e: ApiError) => pushToast({ kind: "error", message: e.message }),
  });
}

export function useChangePassword() {
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (body: ChangePasswordInput) => AuthAPI.changePassword(body),
    onSuccess: () => {
      pushToast({ kind: "success", message: "Password updated" });
      router.back();
    },
    onError: (e: ApiError) => pushToast({ kind: "error", message: e.message }),
  });
}
