import { useEffect, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { OptionChainAPI } from "@features/trade/api/market.api";
import { marketdata } from "@features/trade/services/marketdata.service";
import type {
  OptionChainConfig,
  OptionChainResponse,
} from "@features/trade/types/option-chain.types";

export function useOptionChainConfig() {
  return useQuery<OptionChainConfig>({
    queryKey: ["option-chain", "config"],
    queryFn: () => OptionChainAPI.config(),
    staleTime: 5 * 60_000,
  });
}

export function useOptionChain(underlying: string | null, expiry?: string | null) {
  const enabled = !!underlying && underlying.length > 0;
  const query = useQuery<OptionChainResponse>({
    queryKey: ["option-chain", underlying, expiry ?? ""],
    queryFn: () => OptionChainAPI.fetch(underlying as string, expiry ?? undefined),
    enabled,
    // Fast 2 s poll — matches backend 2.5 s cache + matches user
    // expectation of "instant" updates. WS pushes per-strike LTPs in
    // realtime; this poll keeps spot price + ATM recentering snappy.
    refetchInterval: 2_000,
    refetchIntervalInBackground: false,
    staleTime: 1_500,
    // Keep the previous chain on screen while a new underlying/expiry loads —
    // no more blank "Loading…" state when the user switches Nifty → BankNifty
    // or flips expiries. The fresh data swaps in within ~80 ms of arrival.
    placeholderData: keepPreviousData,
  });

  // Subscribe every visible strike's token to the marketdata WS so the strip
  // updates between REST polls. Re-subscribes whenever the rows array
  // changes (different expiry / centring around a new ATM).
  const tokens = useMemo<string[]>(() => {
    const t: string[] = [];
    for (const r of query.data?.rows ?? []) {
      if (r.ce?.token) t.push(String(r.ce.token));
      if (r.pe?.token) t.push(String(r.pe.token));
    }
    return t;
  }, [query.data?.rows]);

  useEffect(() => {
    if (tokens.length === 0) return;
    marketdata.subscribe(tokens);
    return () => marketdata.unsubscribe(tokens);
  }, [tokens]);

  return query;
}
