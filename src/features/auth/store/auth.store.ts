import { create } from "zustand";
import { mmkv } from "@core/storage/mmkv";
import { secureStore } from "@core/storage/secureStore";
import { STORAGE_KEYS } from "@core/storage/keys";
import { clearTokens, setTokens } from "@core/api/tokens";
import type { User } from "@features/auth/types/user.types";

interface AuthState {
  user: User | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  setSession: (user: User, access: string, refresh: string) => Promise<void>;
  setUser: (user: User) => void;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  isAuthenticated: false,

  setSession: async (user, access, refresh) => {
    await setTokens(access, refresh);
    mmkv.setJSON(STORAGE_KEYS.user, user);
    set({ user, isAuthenticated: true });
  },

  setUser: (user) => {
    mmkv.setJSON(STORAGE_KEYS.user, user);
    set({ user });
  },

  signOut: async () => {
    await clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  // Treat the user as authenticated if EITHER the access token OR the
  // refresh token is on disk. The previous "access-only" gate punted
  // users to /login on every cold start where the 15-min access JWT
  // had expired even though a perfectly good 30-day refresh token was
  // sitting in SecureStore. Now we hand off to the API client — the
  // first authed request silently refreshes via /auth/refresh and the
  // user never sees a login screen. Matches Zerodha / Groww UX.
  hydrate: async () => {
    const cached = mmkv.getJSON<User>(STORAGE_KEYS.user);
    const hasAccess = !!mmkv.getString(STORAGE_KEYS.accessToken);
    let hasRefresh = false;
    try {
      hasRefresh = !!(await secureStore.get(STORAGE_KEYS.refreshToken));
    } catch {
      hasRefresh = false;
    }
    set({
      user: cached,
      isAuthenticated: !!cached && (hasAccess || hasRefresh),
      hydrated: true,
    });
  },
}));
