import type { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import type { ApiErrorResponse } from "@core/types/api";
import { getAccessToken, getRefreshToken } from "./tokens";
import { notifyAuthFailure, refreshAccessToken } from "./refresh";

export function attachInterceptors(client: AxiosInstance): void {
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (resp) => resp,
    async (error: AxiosError<ApiErrorResponse>) => {
      const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
      const status = error.response?.status;
      if (status === 401 && original && !original._retry) {
        original._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          original.headers = {
            ...(original.headers || {}),
            Authorization: `Bearer ${newToken}`,
          };
          return client.request(original);
        }
        // Only redirect to login when the refresh token is ACTUALLY
        // dead (cleared by doRefresh on 401/403 from /refresh). If the
        // refresh failed transiently (network error / timeout / 5xx),
        // `getRefreshToken()` still returns the cached value — leave
        // the user logged in and let the next request retry. Matches
        // Zerodha's behaviour: a dropped wifi packet doesn't kick you
        // out of the app.
        const stillHasRefresh = await getRefreshToken();
        if (!stillHasRefresh) {
          notifyAuthFailure();
        }
      }
      return Promise.reject(error);
    },
  );
}
