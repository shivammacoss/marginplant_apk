export const STORAGE_KEYS = {
  accessToken: "nb.accessToken",
  refreshToken: "nb.refreshToken",
  user: "nb.user",
  watchlist: "nb.watchlist",
  theme: "nb.theme",
  language: "nb.language",
  biometric: "nb.biometric",
  lastSymbol: "nb.lastSymbol",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
