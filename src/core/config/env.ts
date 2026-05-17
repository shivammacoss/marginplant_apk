import Constants from "expo-constants";

function read(key: string, fallback: string): string {
  const fromProc = process.env[key];
  if (fromProc && fromProc.length > 0) return fromProc;
  const fromExtra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const val = fromExtra[key];
  if (typeof val === "string" && val.length > 0) return val;
  return fallback;
}

// Production URLs as the HARDCODED fallback. EAS Build runs in the cloud
// and doesn't read the local `.env`, so without the env var being injected
// (eas.json `env` block / EAS dashboard variables) the fallback wins.
// Hardcoding the prod host means a fresh APK install hits api.marginplant.com
// even before any OTA / rebuild.
const FALLBACK_API_URL = "https://api.marginplant.com";
const FALLBACK_WS_URL = "wss://api.marginplant.com";

export const env = {
  API_URL: read("EXPO_PUBLIC_API_URL", FALLBACK_API_URL),
  WS_URL: read("EXPO_PUBLIC_WS_URL", FALLBACK_WS_URL),
  APP_NAME: read("EXPO_PUBLIC_APP_NAME", "MarginPlant"),
  ENV: read("EXPO_PUBLIC_ENV", "production"),
} as const;

export const isProd = env.ENV === "production";
export const isDev = env.ENV === "development";
