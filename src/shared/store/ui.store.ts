import { create } from "zustand";

export type ToastKind = "success" | "error" | "info" | "warn";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  ttlMs?: number;
}

interface UiState {
  toasts: Toast[];
  pushToast: (t: Omit<Toast, "id">) => string;
  dismissToast: (id: string) => void;

  bottomSheetOpen: boolean;
  setBottomSheetOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],

  pushToast: (t) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, ...t }] }));
    return id;
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  bottomSheetOpen: false,
  setBottomSheetOpen: (open) => set({ bottomSheetOpen: open }),
}));
