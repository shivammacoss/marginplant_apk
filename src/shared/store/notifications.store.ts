import { create } from "zustand";
import { mmkv } from "@core/storage/mmkv";

type Key = "trades" | "priceAlerts" | "marketNews" | "promos";

const STORE_KEY = "nb.notifPrefs";

export interface NotifPrefs {
  trades: boolean;
  priceAlerts: boolean;
  marketNews: boolean;
  promos: boolean;
}

const DEFAULTS: NotifPrefs = {
  trades: true,
  priceAlerts: true,
  marketNews: true,
  promos: false,
};

interface NotifState extends NotifPrefs {
  hydrated: boolean;
  set: (key: Key, value: boolean) => void;
  hydrate: () => void;
}

export const useNotifPrefsStore = create<NotifState>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  set: (key, value) => {
    set({ [key]: value } as Pick<NotifState, Key>);
    const s = get();
    mmkv.setJSON(STORE_KEY, {
      trades: s.trades,
      priceAlerts: s.priceAlerts,
      marketNews: s.marketNews,
      promos: s.promos,
    });
  },

  hydrate: () => {
    if (get().hydrated) return;
    const stored = mmkv.getJSON<NotifPrefs>(STORE_KEY);
    set({ ...(stored ?? DEFAULTS), hydrated: true });
  },
}));
