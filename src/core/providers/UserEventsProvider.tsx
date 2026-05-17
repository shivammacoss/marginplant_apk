import { ReactNode, useEffect, useRef } from "react";
import { AppState } from "react-native";
import {
  notifyManager,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useAuthStore } from "@features/auth/store/auth.store";
import { useUiStore } from "@shared/store/ui.store";
import { log } from "@shared/utils/logger";

interface Props {
  children: ReactNode;
}

/**
 * Subscribes to `/ws/user` once the user is authenticated, dispatches each
 * event to the React Query cache so order / position / wallet UIs update
 * instantly without polling.
 *
 * userSocket is loaded lazily (dynamic import on first use) so any failure
 * inside the WS module — bad WS_URL, native module not linked, etc. — never
 * stops app boot. We swallow init errors and log them; UI keeps working
 * via REST polling as a fallback.
 */
export function UserEventsProvider({ children }: Props) {
  const qc = useQueryClient();
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  const pushToast = useUiStore((s) => s.pushToast);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect(client: QueryClient) {
      try {
        const mod = await import("@core/websocket/userSocket");
        if (cancelled) return;
        const unsub = mod.userSocket.on((ev) => {
          try {
            handleEvent(ev, client, pushToast);
          } catch (e) {
            log.warn("user ws handler threw", e);
          }
        });
        cleanupRef.current = () => {
          unsub();
          mod.userSocket.disconnect();
        };
      } catch (e) {
        log.warn("user ws init failed", e);
      }
    }

    if (isAuth) {
      void connect(qc);
    } else {
      cleanupRef.current?.();
      cleanupRef.current = null;
    }

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [isAuth, qc, pushToast]);

  // Reconnect on foreground after device sleep.
  useEffect(() => {
    if (!isAuth) return;
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;
      try {
        const mod = await import("@core/websocket/userSocket");
        if (!mod.userSocket.isConnected()) mod.userSocket.connect();
      } catch (e) {
        log.warn("user ws resume failed", e);
      }
    });
    return () => sub.remove();
  }, [isAuth]);

  return <>{children}</>;
}

interface UserEvent {
  type: string;
  payload?: unknown;
}

function handleEvent(
  ev: UserEvent,
  qc: QueryClient,
  pushToast: (t: { kind: "info"; message: string; ttlMs?: number }) => string,
): void {
  // Batch every invalidate path through notifyManager.batch() so React only
  // schedules one re-render per WS event — without this, a "position" event
  // would invalidate ["positions"] + ["holdings"] in two ticks, causing two
  // parallel refetch storms.
  switch (ev.type) {
    case "order":
      notifyManager.batch(() => {
        void qc.invalidateQueries({ queryKey: ["orders"] });
      });
      return;
    case "position":
      notifyManager.batch(() => {
        void qc.invalidateQueries({ queryKey: ["positions"] });
        void qc.invalidateQueries({ queryKey: ["holdings"] });
      });
      return;
    case "wallet":
      notifyManager.batch(() => {
        void qc.invalidateQueries({ queryKey: ["wallet"] });
      });
      return;
    case "kyc":
      notifyManager.batch(() => {
        void qc.invalidateQueries({ queryKey: ["kyc"] });
      });
      return;
    case "notification": {
      // Only invalidate the notifications cache — DON'T push a toast.
      //
      // The backend fans out a `notification` event for every order / position
      // / wallet update which used to produce a dark "info" toast ~1 s after
      // the green REST `onSuccess` toast, giving users 2 popups per trade
      // (the visible black-then-green sequence the user reported).
      //
      // The user-facing toasts already come from the action that triggered
      // the event (usePlaceOrder, useDeposit, useSquareoff…). For passive
      // notifications the user can check the Notifications screen — the
      // cache is fresh thanks to the invalidate above.
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      return;
    }
    case "marketwatch": {
      // Fired by the backend when ANY of this user's clients (apk / web /
      // mobile-web) mutates a watchlist. Invalidating both the list itself
      // and the per-segment lists keeps every session in lock-step —
      // adding a fav on the web shows up on the apk within ~50ms instead
      // of waiting for the next REST refetch.
      notifyManager.batch(() => {
        void qc.invalidateQueries({ queryKey: ["marketwatch"] });
        void qc.invalidateQueries({ queryKey: ["watchlist-quotes"] });
        void qc.invalidateQueries({ queryKey: ["segment-items"] });
      });
      return;
    }
  }
}
