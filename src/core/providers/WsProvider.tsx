import { ReactNode, useEffect } from "react";
import { AppState } from "react-native";
import { useAuthStore } from "@features/auth/store/auth.store";
import { useWatchlistStore } from "@features/trade/store/watchlist.store";
import { marketdata } from "@features/trade/services/marketdata.service";

interface Props {
  children: ReactNode;
}

export function WsProvider({ children }: Props) {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  const hydrate = useWatchlistStore((s) => s.hydrate);
  const symbols = useWatchlistStore((s) => s.symbols);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isAuth) {
      marketdata.disconnect();
      return;
    }
    if (symbols.length > 0) marketdata.subscribe(symbols);
  }, [isAuth, symbols]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && isAuth && symbols.length > 0) {
        marketdata.subscribe(symbols);
      }
    });
    return () => sub.remove();
  }, [isAuth, symbols]);

  return <>{children}</>;
}
