import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MarketAPI, type SearchParams } from "@features/trade/api/market.api";

export function useInstrumentSearch(params: SearchParams, enabled = true) {
  const q = (params.q ?? "").trim();
  const hasFilter = q.length > 0 || !!params.segment || !!params.exchange;
  return useQuery({
    queryKey: ["instruments", "search", params],
    queryFn: () => MarketAPI.search(params),
    enabled: enabled && hasFilter,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}
