import { create } from "zustand";
import { secureStore } from "@core/storage/secureStore";
import { mmkv } from "@core/storage/mmkv";
import { STORAGE_KEYS } from "@core/storage/keys";

const PIN_KEY = "nb.pin";
const PIN_LEN = 4;

interface PinState {
  hasPin: boolean;
  unlocked: boolean;
  biometricEnabled: boolean;
  hydrate: () => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  clearPin: () => Promise<void>;
  setUnlocked: (v: boolean) => void;
  setBiometricEnabled: (v: boolean) => void;
}

export const usePinStore = create<PinState>((set, get) => ({
  hasPin: false,
  unlocked: false,
  biometricEnabled: false,

  hydrate: async () => {
    const pin = await secureStore.get(PIN_KEY);
    const bio = mmkv.getBoolean(STORAGE_KEYS.biometric) ?? false;
    set({ hasPin: !!pin && pin.length === PIN_LEN, biometricEnabled: bio });
  },

  setPin: async (pin) => {
    if (pin.length !== PIN_LEN) throw new Error(`PIN must be ${PIN_LEN} digits`);
    await secureStore.set(PIN_KEY, pin);
    set({ hasPin: true, unlocked: true });
  },

  verifyPin: async (pin) => {
    const stored = await secureStore.get(PIN_KEY);
    const ok = stored === pin && pin.length === PIN_LEN;
    if (ok) set({ unlocked: true });
    return ok;
  },

  clearPin: async () => {
    await secureStore.remove(PIN_KEY);
    mmkv.setBoolean(STORAGE_KEYS.biometric, false);
    set({ hasPin: false, unlocked: false, biometricEnabled: false });
  },

  setUnlocked: (v) => set({ unlocked: v }),

  setBiometricEnabled: (v) => {
    mmkv.setBoolean(STORAGE_KEYS.biometric, v);
    set({ biometricEnabled: v });
  },
}));

export const PIN_LENGTH = PIN_LEN;
