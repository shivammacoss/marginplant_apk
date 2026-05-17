import { create } from "zustand";
import { i18n } from "@core/i18n";
import { mmkv } from "@core/storage/mmkv";
import { STORAGE_KEYS } from "@core/storage/keys";

export type LanguageCode = "en" | "hi";

export const LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
];

interface LanguageState {
  code: LanguageCode;
  hydrated: boolean;
  setLanguage: (code: LanguageCode) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  code: "en",
  hydrated: false,

  setLanguage: async (code) => {
    await i18n.changeLanguage(code);
    mmkv.setString(STORAGE_KEYS.language, code);
    set({ code });
  },

  hydrate: async () => {
    if (get().hydrated) return;
    const stored = mmkv.getString(STORAGE_KEYS.language) as LanguageCode | null;
    const code: LanguageCode = stored === "hi" ? "hi" : "en";
    await i18n.changeLanguage(code);
    set({ code, hydrated: true });
  },
}));
