export interface OptionLeg {
  token: string;
  symbol: string;
  exchange: string;
  strike: number;
  option_type: "CE" | "PE";
  lot_size?: number;
  ltp: number | null;
  bid: number | null;
  ask: number | null;
  change_pct: number | null;
  volume: number | null;
  oi?: number | null;
  source?: "live" | "rest" | null;
}

export interface OptionRow {
  strike: number;
  ce: OptionLeg | null;
  pe: OptionLeg | null;
}

export interface OptionChainResponse {
  underlying: string;
  spot: number | null;
  atm_strike?: number | null;
  expiry: string | null;
  expiries: string[];
  rows: OptionRow[];
  market_open?: boolean;
}

export interface OptionChainConfig {
  underlyings: {
    label: string;
    symbol: string;
    color?: string;
  }[];
  strikes_around_atm: number;
  max_expiries: number;
}
