import { api } from "@core/api/client";
import { unwrap } from "@core/api/errors";
import type { Instrument, MarketDepth, Tick } from "@features/trade/types/instrument.types";
import type {
  OptionChainConfig,
  OptionChainResponse,
} from "@features/trade/types/option-chain.types";

export interface SearchParams {
  q?: string;
  segment?: string;
  exchange?: string;
  instrument_type?: string;
  limit?: number;
}

export interface Quote {
  token: string;
  ltp: number;
  change: number;
  change_pct: number;
  open: number;
  high: number;
  low: number;
  prev_close: number;
  volume: number;
  bid: number;
  ask: number;
  source?: string | null;
}

export const MarketAPI = {
  search: (params: SearchParams = {}) =>
    unwrap<Instrument[]>(api.get("/user/instruments/search", { params })),
  instrument: (token: string) =>
    unwrap<Instrument>(api.get(`/user/instruments/${encodeURIComponent(token)}`)),
  quote: (token: string) =>
    unwrap<Quote>(api.get(`/user/instruments/${encodeURIComponent(token)}/quote`)),
  ltp: (tokens: string[]) =>
    unwrap<Tick[]>(api.get("/user/market/ltp", { params: { tokens: tokens.join(",") } })),
  depth: (token: string) =>
    unwrap<MarketDepth>(api.get(`/user/market/${encodeURIComponent(token)}/depth`)),
};

export const OptionChainAPI = {
  config: () => unwrap<OptionChainConfig>(api.get("/user/option-chain/config")),
  fetch: (underlying: string, expiry?: string) =>
    unwrap<OptionChainResponse>(
      api.get("/user/option-chain", {
        params: { underlying, ...(expiry ? { expiry } : {}) },
      }),
    ),
};
