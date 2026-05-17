import { useCallback } from "react";
import * as Haptics from "expo-haptics";

type Kind = "selection" | "light" | "medium" | "heavy" | "success" | "warn" | "error";

export function useHaptics() {
  return useCallback((kind: Kind = "selection") => {
    switch (kind) {
      case "selection":
        return Haptics.selectionAsync();
      case "light":
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case "medium":
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case "heavy":
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case "success":
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case "warn":
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case "error":
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, []);
}
