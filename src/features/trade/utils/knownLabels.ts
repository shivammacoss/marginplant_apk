// Pre-known display info for the seeded default favourites — saves a network
// round-trip on first launch and gives a friendly name even when the backend
// instrument detail endpoint is slow/offline.
export interface KnownLabel {
  symbol: string;
  name: string;
  exchange: string;
}

const KNOWN: Record<string, KnownLabel> = {
  "256265":        { symbol: "NIFTY 50",  name: "Nifty 50 Index",         exchange: "NSE" },
  "260105":        { symbol: "NIFTY BANK", name: "Bank Nifty Index",       exchange: "NSE" },
  "265":           { symbol: "SENSEX",    name: "BSE Sensex",             exchange: "BSE" },
  "260617":        { symbol: "NIFTY 100", name: "Nifty 100 Index",        exchange: "NSE" },
  "257801":        { symbol: "FINNIFTY",  name: "Fin Nifty Index",        exchange: "NSE" },
  "738561":        { symbol: "RELIANCE",  name: "Reliance Industries",    exchange: "NSE" },
  "2953217":       { symbol: "TCS",       name: "Tata Consultancy",       exchange: "NSE" },
  "341249":        { symbol: "HDFCBANK",  name: "HDFC Bank",              exchange: "NSE" },
  "1270529":       { symbol: "ICICIBANK", name: "ICICI Bank",             exchange: "NSE" },
  "408065":        { symbol: "INFY",      name: "Infosys",                exchange: "NSE" },
  FX_EURUSD:       { symbol: "EUR / USD", name: "Euro / US Dollar",       exchange: "FX" },
  FX_GBPUSD:       { symbol: "GBP / USD", name: "Pound / US Dollar",      exchange: "FX" },
  FX_USDJPY:       { symbol: "USD / JPY", name: "US Dollar / Yen",        exchange: "FX" },
  FX_USDINR:       { symbol: "USD / INR", name: "US Dollar / Rupee",      exchange: "FX" },
  FX_AUDUSD:       { symbol: "AUD / USD", name: "Aussie / US Dollar",     exchange: "FX" },
  CRYPTO_BTCUSD:   { symbol: "BTC / USD", name: "Bitcoin / USD",          exchange: "CRYPTO" },
  CRYPTO_ETHUSD:   { symbol: "ETH / USD", name: "Ethereum / USD",         exchange: "CRYPTO" },
  CRYPTO_SOLUSD:   { symbol: "SOL / USD", name: "Solana / USD",           exchange: "CRYPTO" },
  CRYPTO_XRPUSD:   { symbol: "XRP / USD", name: "Ripple / USD",           exchange: "CRYPTO" },
  CRYPTO_DOGEUSD:  { symbol: "DOGE / USD", name: "Dogecoin / USD",        exchange: "CRYPTO" },
};

export function getKnownLabel(token: string): KnownLabel | null {
  return KNOWN[token] ?? null;
}
