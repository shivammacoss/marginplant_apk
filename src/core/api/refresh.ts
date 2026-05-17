import axios, { type AxiosError } from "axios";
import { env } from "@core/config/env";
import type { ApiResponse, TokenPair } from "@core/types/api";
import { clearTokens, getRefreshToken, setTokens } from "./tokens";

let inflight: Promise<string | null> | null = null;
let onFailure: (() => void) | null = null;

export function onAuthFailure(cb: () => void): void {
  onFailure = cb;
}

export function notifyAuthFailure(): void {
  onFailure?.();
}

/**
 * Treat `401` and `403` from the refresh endpoint as "the refresh token is
 * dead" — clear local credentials and force the user to log in again.
 * Anything else (network error, 5xx, timeout) is a TRANSIENT failure: we
 * return null but DO NOT clear tokens, so the next request can try the
 * refresh again. This is what Zerodha / Groww / Upstox do — losing wifi
 * for 30s should never punt you back to the login screen.
 */
function isRefreshTokenDead(e: unknown): boolean {
  const err = e as AxiosError | undefined;
  const status = err?.response?.status;
  return status === 401 || status === 403;
}

async function doRefresh(): Promise<string | null> {
  const refresh = await getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await axios.post<ApiResponse<TokenPair>>(
      `${env.API_URL}/api/v1/user/auth/refresh`,
      { refresh_token: refresh },
      { timeout: 15_000 },
    );
    const pair = res.data.data;
    if (!pair) return null;
    await setTokens(pair.access_token, pair.refresh_token);
    return pair.access_token;
  } catch (e) {
    // ONLY clear local tokens when the server explicitly rejected the
    // refresh as expired/invalid. Network blips, timeouts, 5xx etc.
    // leave the refresh-token intact so the user stays logged in and
    // the next call retries automatically.
    if (isRefreshTokenDead(e)) {
      await clearTokens();
    }
    return null;
  }
}

export function refreshAccessToken(): Promise<string | null> {
  inflight ||= doRefresh().finally(() => {
    inflight = null;
  });
  return inflight;
}
