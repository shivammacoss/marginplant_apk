import { ReactNode, useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  FadeInUp,
  FadeOutUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore, type ToastKind } from "@shared/store/ui.store";
import { Text } from "@shared/ui/Text";
import { colors } from "@shared/theme";

const KIND_STYLE: Record<
  ToastKind,
  { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  success: { bg: colors.buy, fg: "#fff", icon: "checkmark-circle" },
  error: { bg: colors.sell, fg: "#fff", icon: "alert-circle" },
  info: { bg: colors.bgElevated, fg: colors.text, icon: "information-circle" },
  warn: { bg: "#F59E0B", fg: "#fff", icon: "warning" },
};

interface Props {
  children: ReactNode;
}

export function ToastProvider({ children }: Props) {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => dismiss(t.id), t.ttlMs ?? 2200),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <>
      {children}
      {/* `box-none` instead of `none` so the wrapper itself is touch-
          transparent (taps fall through to whatever's underneath) BUT
          each toast pressable still receives touches. Without this,
          `pointerEvents="none"` blocked even the toast's own onPress —
          the user couldn't tap to dismiss and had to wait the full
          2.2 s TTL while the toast covered their next action. */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 12,
          right: 12,
          gap: 8,
        }}
      >
        {toasts.map((t) => {
          const s = KIND_STYLE[t.kind] ?? KIND_STYLE.info;
          return (
            <Animated.View
              key={t.id}
              entering={FadeInUp.duration(180)}
              exiting={FadeOutUp.duration(140)}
            >
              {/* Tap anywhere on the toast to dismiss it immediately —
                  the user explicitly asked for this so a lingering
                  buy/sell confirmation can be cleared instead of
                  blocking the next interaction for 2 s. */}
              <Pressable
                onPress={() => dismiss(t.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: s.bg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  shadowColor: "#000",
                  shadowOpacity: 0.18,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                }}
              >
                <Ionicons name={s.icon} size={18} color={s.fg} />
                <Text
                  style={{
                    color: s.fg,
                    fontWeight: "600",
                    marginLeft: 10,
                    flex: 1,
                  }}
                  numberOfLines={2}
                >
                  {t.message}
                </Text>
                <Ionicons name="close" size={14} color={s.fg} style={{ opacity: 0.7, marginLeft: 8 }} />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </>
  );
}
