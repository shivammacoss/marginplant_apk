import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MarketAPI, type Quote } from "@features/trade/api/market.api";

export function useQuote(token: string | null | undefined) {
  return useQuery<Quote>({
    queryKey: ["quote", token],
    queryFn: () => MarketAPI.quote(token as string),
    enabled: !!token,
    // Cheap, frequently-changing endpoint — refresh every 5s while sheet open
    // so high/low/open settle without WS dependency on first paint.
    staleTime: 4_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: false,
    retry: 1,
    // Keep the previous snapshot on screen while a new fetch is in flight.
    // Without this, every 5s poll causes a brief "loading" state in the
    // TradeSheet KPI grid (high/low/open flash to "—").
    placeholderData: keepPreviousData,
  });
}
