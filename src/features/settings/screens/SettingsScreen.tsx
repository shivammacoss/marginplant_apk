import { type ReactNode } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { Toggle } from "@shared/ui/Toggle";
import { colors, spacing } from "@shared/theme";
import { usePinStore } from "@features/auth/store/pin.store";
import { useAuthStore } from "@features/auth/store/auth.store";
import { useBiometric } from "@shared/hooks/useBiometric";
import { useUiStore } from "@shared/store/ui.store";
import { useThemeStore } from "@shared/store/theme.store";
import { useNetworkState } from "@shared/hooks/useNetworkState";

const THEME_LABEL = { dark: "Dark", light: "Light", system: "System" } as const;

export function SettingsScreen() {
  const bioEnabled = usePinStore((s) => s.biometricEnabled);
  const hasPin = usePinStore((s) => s.hasPin);
  const setBio = usePinStore((s) => s.setBiometricEnabled);
  const clearPin = usePinStore((s) => s.clearPin);
  const { supported, prompt } = useBiometric();
  const pushToast = useUiStore((s) => s.pushToast);
  const themeMode = useThemeStore((s) => s.mode);
  const signOut = useAuthStore((s) => s.signOut);
  const net = useNetworkState();

  const netOk = net.isConnected && net.isInternetReachable !== false;

  async function toggleBio(next: boolean) {
    if (next && !supported) {
      pushToast({
        kind: "warn",
        message: "Biometric not available on this device",
      });
      return;
    }
    if (next && !hasPin) {
      // Biometric without a PIN fallback is a lock-out risk — if the
      // sensor stops recognising the user (wet finger, broken sensor)
      // they can't recover on this device. Force a PIN first.
      pushToast({
        kind: "warn",
        message: "Set a PIN first — biometric uses it as fallback.",
      });
      return;
    }
    if (next) {
      const ok = await prompt("Enable biometric login");
      if (!ok) return;
    }
    setBio(next);
    pushToast({
      kind: "success",
      message: next ? "Biometric login enabled" : "Biometric login disabled",
    });
  }

  // PIN-lock toggle. When OFF and user flips ON → route to /pin-set so
  // they set a 4-digit PIN; the screen flips hasPin=true on save and
  // the toggle reflects on return. When ON and user flips OFF → confirm
  // dialog → clearPin() wipes secure-store + auto-disables biometric.
  function togglePin(next: boolean) {
    if (next) {
      // No PIN yet — open setup flow.
      router.push("/(auth)/pin-set");
      return;
    }
    Alert.alert(
      "Remove PIN?",
      "Turning off the PIN will also disable biometric login. You'll go straight to the app on launch.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await clearPin();
            pushToast({ kind: "success", message: "PIN lock disabled" });
          },
        },
      ],
    );
  }

  function confirmLogout() {
    Alert.alert("Log out?", "You'll need to sign in again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Header title="Settings" back />
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing["3xl"],
          paddingTop: spacing.sm,
        }}
        showsVerticalScrollIndicator={false}
      >
        <SettingRow
          icon="contrast-outline"
          title="Theme"
          value={THEME_LABEL[themeMode]}
          onPress={() => router.push("/settings/theme")}
        />
        {/* PIN-lock master toggle. OFF by default — flipping ON routes
            to /pin-set; flipping OFF wipes the PIN + biometric. Replaces
            the previous "Change PIN" row that just routed to setup with
            no way to disable. */}
        <SettingRow
          icon="lock-closed-outline"
          title="PIN lock"
          subtitle={hasPin ? "4-digit PIN required on launch" : "App opens directly"}
          right={
            <Toggle
              value={hasPin}
              onChange={togglePin}
            />
          }
        />
        {/* Change PIN — only meaningful when a PIN exists. Goes through
            the same pin-set flow which now correctly re-focuses the
            input on the "Re-enter PIN" stage (key={stage} fix). */}
        {hasPin ? (
          <SettingRow
            icon="keypad-outline"
            title="Change PIN"
            subtitle="Pick a new 4-digit PIN"
            onPress={() => router.push("/(auth)/pin-set")}
          />
        ) : null}
        <SettingRow
          icon="finger-print-outline"
          title="Biometric login"
          subtitle={
            !supported
              ? "Not available on this device"
              : !hasPin
                ? "Set a PIN first to enable"
                : undefined
          }
          right={
            <Toggle
              value={bioEnabled}
              onChange={toggleBio}
              disabled={!supported || !hasPin}
            />
          }
        />
        <SettingRow
          icon="notifications-outline"
          title="Notification preferences"
          onPress={() => router.push("/settings/notifications")}
        />
        <SettingRow
          icon="globe-outline"
          title="Check internet connectivity"
          value={netOk ? "Online" : "Offline"}
          valueTone={netOk ? "ok" : "danger"}
          onPress={() => router.push("/settings/network")}
        />
        <SettingRow
          icon="log-out-outline"
          iconTint={colors.sell}
          title="Log out"
          titleTone="sell"
          showChevron={false}
          onPress={confirmLogout}
        />

        <View style={{ alignItems: "center", marginTop: spacing.xl }}>
          <Text tone="dim" size="xs">
            MarginPlant • v1.0.0
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconTint?: string;
  title: string;
  subtitle?: string;
  value?: string;
  valueTone?: "default" | "ok" | "danger";
  titleTone?: "default" | "sell";
  right?: ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
}

// IMPORTANT: styles are computed inline on every render — do NOT lift them
// to a module-level `const styles` because `colors` is mutated by
// applyPalette() on theme change. A captured constant would freeze the
// dark-palette values at module load, leaving the icon backgrounds dark
// even after switching to the light theme.
function SettingRow({
  icon,
  iconTint,
  title,
  subtitle,
  value,
  valueTone = "default",
  titleTone = "default",
  right,
  showChevron = true,
  onPress,
}: SettingRowProps) {
  const valueColor =
    valueTone === "ok"
      ? colors.buy
      : valueTone === "danger"
      ? colors.sell
      : colors.textMuted;
  const titleColor = titleTone === "sell" ? colors.sell : colors.text;

  return (
    <Pressable onPress={onPress} android_ripple={{ color: colors.bgSurface }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 4,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.bgElevated,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name={icon} size={18} color={iconTint ?? colors.textMuted} />
        </View>

        <View style={{ flex: 1, flexShrink: 1 }}>
          <Text
            style={{ fontSize: 15, fontWeight: "500", color: titleColor }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text tone="muted" size="sm" style={{ marginTop: 2 }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {right ? (
          right
        ) : (
          <>
            {value ? (
              <Text style={{ color: valueColor, fontSize: 14, fontWeight: "500" }}>
                {value}
              </Text>
            ) : null}
            {showChevron ? (
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textDim}
                style={{ marginLeft: 6 }}
              />
            ) : null}
          </>
        )}
      </View>
    </Pressable>
  );
}
