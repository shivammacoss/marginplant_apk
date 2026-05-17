import { mmkv } from "@core/storage/mmkv";
import { secureStore } from "@core/storage/secureStore";
import { STORAGE_KEYS } from "@core/storage/keys";

export function getAccessToken(): string | null {
  return mmkv.getString(STORAGE_KEYS.accessToken);
}

export function getRefreshToken(): Promise<string | null> {
  return secureStore.get(STORAGE_KEYS.refreshToken);
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  mmkv.setString(STORAGE_KEYS.accessToken, access);
  await secureStore.set(STORAGE_KEYS.refreshToken, refresh);
}

export async function clearTokens(): Promise<void> {
  mmkv.remove(STORAGE_KEYS.accessToken);
  mmkv.remove(STORAGE_KEYS.user);
  await secureStore.remove(STORAGE_KEYS.refreshToken);
}
