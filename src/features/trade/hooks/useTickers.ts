import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { useTickerStore } from "@features/trade/store/ticker.store";
import { marketdata } from "@features/trade/services/marketdata.service";
import type { Tick } from "@features/trade/types/instrument.types";

// Subscribe-only variant. Manages WS subscribe/unsubscribe lifecycle for a list
// of tokens — does NOT subscribe to the ticker store, so consumers don't
// re-render on every tick. Use this when the list rows fetch their own price
// via `useTicker(token)` (which uses a per-symbol selector → fine-grained
// updates).
//
// Before this split, `useTickers` subscribed to `s.ticks` (the WHOLE map), so
// every tick on any subscribed token triggered a re-render of MarketScreen +
// every visible row. With 50 instruments at 5 ticks/sec that's 250 useless
// re-renders/sec. After: zero re-renders triggered by this hook.
export function useTickerSubscription(symbols: string[]): void {
  useEffect(() => {
    if (symbols.length === 0) return;
    marketdata.subscribe(symbols);
    return () => marketdata.unsubscribe(symbols);
  }, [symbols.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Map variant — for components that actually USE the tick data themselves
// (HomeScreen indices grid, MarketOverview cards, WatchlistScreen). Uses
// `useShallow` so the hook only re-renders when one of the *subscribed*
// symbols' tick changes — not on every store update.
export function useTickersMap(
  symbols: string[],
): Record<string, Tick | undefined> {
  useTickerSubscription(symbols);

  const key = symbols.join(",");
  const symbolsArr = useMemo(() => symbols, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return useTickerStore(
    useShallow((s) => {
      const out: Record<string, Tick | undefined> = {};
      for (const sym of symbolsArr) out[sym] = s.ticks[sym];
      return out;
    }),
  );
}

// Backwards-compatible alias. New callers should prefer the explicit variants
// above so the perf tradeoff is obvious at the call site.
export const useTickers = useTickersMap;
