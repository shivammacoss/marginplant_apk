import { useQuery } from "@tanstack/react-query";
import { MarketAPI } from "@features/trade/api/market.api";
import { getKnownLabel } from "@features/trade/utils/knownLabels";

export interface InstrumentLabel {
  symbol: string;
  name: string;
  exchange: string;
}

export function useInstrumentLabel(token: string | null | undefined): InstrumentLabel {
  const known = token ? getKnownLabel(token) : null;
  const { data } = useQuery({
    queryKey: ["instrument", token],
    queryFn: () => MarketAPI.instrument(token as string),
    enabled: !!token && !known,
    staleTime: 60 * 60_000, // 1 hour — instrument metadata rarely changes
    retry: 1,
  });

  if (known) return known;
  if (data) {
    return {
      symbol: data.symbol ?? data.trading_symbol ?? (token ?? ""),
      name: data.name ?? data.symbol ?? "",
      exchange: data.exchange ?? "",
    };
  }
  return { symbol: token ?? "—", name: "", exchange: "" };
}
