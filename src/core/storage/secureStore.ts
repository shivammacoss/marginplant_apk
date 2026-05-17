import * as SecureStore from "expo-secure-store";

export const secureStore = {
  get: (k: string): Promise<string | null> => SecureStore.getItemAsync(k),
  set: (k: string, v: string): Promise<void> =>
    SecureStore.setItemAsync(k, v, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    }),
  remove: (k: string): Promise<void> => SecureStore.deleteItemAsync(k),
} as const;
