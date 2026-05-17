import { useEffect } from "react";
import { useTickerStore } from "@features/trade/store/ticker.store";
import { marketdata } from "@features/trade/services/marketdata.service";
import type { Tick } from "@features/trade/types/instrument.types";

export function useTicker(symbol: string | null | undefined): Tick | undefined {
  const tick = useTickerStore((s) => (symbol ? s.ticks[symbol] : undefined));

  useEffect(() => {
    if (!symbol) return;
    marketdata.subscribe([symbol]);
    return () => marketdata.unsubscribe([symbol]);
  }, [symbol]);

  return tick;
}
