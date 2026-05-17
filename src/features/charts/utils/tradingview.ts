/**
 * Map our internal instrument token / symbol to a TradingView exchange:ticker.
 *
 * Backend tokens follow these conventions:
 *   - NSE / BSE equities: numeric Zerodha tokens (e.g. "256265" = NIFTY 50)
 *   - Infoway forex / crypto / metals / energy: symbol used as token directly
 *     (e.g. "XAUUSD", "BTCUSD", "EURUSD") — backend `instrument.token` IS the
 *     symbol for these segments
 *   - Synthetic prefixes (legacy): "FX_<PAIR>", "CRYPTO_<PAIR>", "MCX_FUT_<NAME>"
 *
 * The chart screen receives a single string `token` and we have to figure out
 * the right TradingView ticker. The previous version dropped through to
 * `NSE:<token>` for anything unrecognised, which produced ghosts like
 * `NSE:XAUUSD` — TradingView "symbol doesn't exist" overlay (the bug shown
 * in the user's screenshot).
 */

// Indian indices — for the free TradingView widget we prefer the SPOT
// index symbol (NSE:NIFTY, NSE:BANKNIFTY) when available. Earlier we used
// the 1! continuous-futures suffix, but TV's free tier rejected it for
// many accounts and fell back to Apple Inc (the user's "chart nahi aa
// raha bug). Spot tickers render correctly for every free-tier client
// we've tested.
const INDIAN_INDEX_MAP: Record<string, string> = {
  NIFTY: "NSE:NIFTY",
  NIFTY50: "NSE:NIFTY",
  NIFTY_50: "NSE:NIFTY",
  BANKNIFTY: "NSE:BANKNIFTY",
  "NIFTY BANK": "NSE:BANKNIFTY",
  FINNIFTY: "NSE:CNXFINANCE",
  MIDCPNIFTY: "NSE:NIFTY_MID_SELECT",
  SENSEX: "BSE:SENSEX",
  BANKEX: "BSE:BANKEX",
};

// Spot metals & energies — TVC is TradingView's own continuous-contract feed,
// universally available on free tier (unlike OANDA which some devices block).
const METAL_ENERGY_MAP: Record<string, string> = {
  XAUUSD: "TVC:GOLD",
  XAGUSD: "TVC:SILVER",
  XPTUSD: "TVC:PLATINUM",
  XPDUSD: "TVC:PALLADIUM",
  XCUUSD: "TVC:COPPER",
  GOLD: "TVC:GOLD",
  SILVER: "TVC:SILVER",
  COPPER: "TVC:COPPER",
  CRUDE: "TVC:USOIL",
  CRUDEOIL: "TVC:USOIL",
  WTI: "TVC:USOIL",
  BRENT: "TVC:UKOIL",
  USOIL: "TVC:USOIL",
  UKOIL: "TVC:UKOIL",
  NATGAS: "TVC:NATURALGAS",
  NATURALGAS: "TVC:NATURALGAS",
};

// Common crypto pairs — BINANCE expects USDT (not USD) for most pairs. The
// frontend stores them as e.g. BTCUSD; we suffix-swap USD → USDT at the edge.
const CRYPTO_MAP: Record<string, string> = {
  BTCUSD: "BINANCE:BTCUSDT",
  ETHUSD: "BINANCE:ETHUSDT",
  XRPUSD: "BINANCE:XRPUSDT",
  SOLUSD: "BINANCE:SOLUSDT",
  ADAUSD: "BINANCE:ADAUSDT",
  DOGEUSD: "BINANCE:DOGEUSDT",
  BNBUSD: "BINANCE:BNBUSDT",
  AVAXUSD: "BINANCE:AVAXUSDT",
  MATICUSD: "BINANCE:MATICUSDT",
  LTCUSD: "BINANCE:LTCUSDT",
  DOTUSD: "BINANCE:DOTUSDT",
  LINKUSD: "BINANCE:LINKUSDT",
  TRXUSD: "BINANCE:TRXUSDT",
  SHIBUSD: "BINANCE:SHIBUSDT",
};

// G10 + Asia forex majors. OANDA has the cleanest free-tier feed.
const FOREX_MAP: Record<string, string> = {
  EURUSD: "OANDA:EURUSD",
  GBPUSD: "OANDA:GBPUSD",
  USDJPY: "OANDA:USDJPY",
  USDCHF: "OANDA:USDCHF",
  USDCAD: "OANDA:USDCAD",
  USDINR: "OANDA:USDINR",
  AUDUSD: "OANDA:AUDUSD",
  NZDUSD: "OANDA:NZDUSD",
  EURGBP: "OANDA:EURGBP",
  EURJPY: "OANDA:EURJPY",
  GBPJPY: "OANDA:GBPJPY",
  AUDJPY: "OANDA:AUDJPY",
  EURAUD: "OANDA:EURAUD",
  EURCHF: "OANDA:EURCHF",
  CHFJPY: "OANDA:CHFJPY",
  USDSGD: "OANDA:USDSGD",
  USDHKD: "OANDA:USDHKD",
};

// Zerodha numeric instrument tokens for the major Indian indices.
// Mapped to SPOT tickers (no 1! suffix) so the TradingView free tier
// loads them without paywall — the front-month continuous-future ticker
// triggered a "Symbol doesn't exist" fallback to Apple Inc on many user
// accounts (the original "chart nahi aa raha" bug).
const ZERODHA_TOKEN_MAP: Record<string, string> = {
  "256265": "NSE:NIFTY",
  "260105": "NSE:BANKNIFTY",
  "260617": "NSE:NIFTY100",
  "257801": "NSE:CNXFINANCE",
  "288009": "NSE:NIFTY_MID_SELECT",
  "265": "BSE:SENSEX",
};

// Legacy synthetic prefixes — older builds packed segment into the token.
const SYNTHETIC_PREFIX_MAP: Record<string, string> = {
  MCX_FUT_MCXGOLD: "TVC:GOLD",
  MCX_FUT_MCXSILVER: "TVC:SILVER",
  MCX_FUT_MCXCRUDE: "TVC:USOIL",
  MCX_FUT_MCXNATGAS: "TVC:NATURALGAS",
  MCX_FUT_MCXCOPPER: "TVC:COPPER",
};

const CRYPTO_QUOTE_FIX: Record<string, string> = {
  USD: "USDT",
};

const CRYPTO_BASES = new Set([
  "BTC", "ETH", "XRP", "SOL", "ADA", "DOGE", "BNB", "AVAX", "MATIC", "LTC",
  "DOT", "LINK", "TRX", "SHIB", "UNI", "ATOM", "ETC", "NEAR", "APT", "OP",
  "ARB", "FIL", "ICP", "INJ", "TIA", "SUI", "PEPE",
]);

export const DEFAULT_TV_SYMBOL = "TVC:GOLD";

// Reverse map: given the TV display ticker (e.g. "NIFTY1!", "BANKNIFTY",
// "XAUUSD", "TCS") return the bare underlying symbol the option-chain
// backend expects ("NIFTY", "BANKNIFTY", "XAUUSD", "TCS"). Strips the
// "1!" continuous-front-month marker + any TV-specific aliases.
const TV_DISPLAY_ALIAS: Record<string, string> = {
  CNXFINANCE: "FINNIFTY",
  NIFTY_MID_SELECT: "MIDCPNIFTY",
};

export function tvDisplayToUnderlying(display: string): string {
  const cleaned = display
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/1!$/, "")
    .replace(/_50$/, "")
    .trim();
  return TV_DISPLAY_ALIAS[cleaned] ?? cleaned;
}

function normalise(s: string): string {
  return s.toUpperCase().replace(/\s+/g, "");
}

// Strip trailing month/year/FUT tag, e.g. "GOLD26DECFUT" → "GOLD",
// "NIFTY26DEC25" → "NIFTY", "GOLDMINI24DECFUT" → "GOLD".
function stripFutSuffix(s: string): string {
  return s
    .replace(/(MINI|MIC)$/, "")
    .replace(/\d{0,2}[A-Z]{3}\d{0,4}(FUT|EXP)?$/, "")
    .trim();
}

/**
 * Returns true when the token can be resolved to a real TradingView feed
 * without further metadata. Options / futures with raw numeric Zerodha
 * tokens (e.g. "13152002" = NIFTY 23500 CE) are NOT directly resolvable
 * — TradingView doesn't carry per-contract option charts. Callers should
 * fetch instrument metadata via `useInstrumentLabel` and pass the
 * `underlying` symbol (NIFTY, BANKNIFTY, …) to `toTradingViewSymbol` for
 * those tokens so the chart shows the underlying instead of a junk
 * fallback.
 */
export function isResolvableToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const raw = decodeURIComponent(token);
  if (/^\d+$/.test(raw)) return raw in ZERODHA_TOKEN_MAP;
  if (SYNTHETIC_PREFIX_MAP[raw]) return true;
  if (raw.startsWith("FX_") || raw.startsWith("CRYPTO_") || raw.startsWith("MCX_FUT_"))
    return true;
  const sym = normalise(raw);
  const baseSym = stripFutSuffix(sym).replace(/^MCX/, "");
  return (
    sym in INDIAN_INDEX_MAP ||
    baseSym in INDIAN_INDEX_MAP ||
    sym in METAL_ENERGY_MAP ||
    baseSym in METAL_ENERGY_MAP ||
    sym in CRYPTO_MAP ||
    sym in FOREX_MAP ||
    /^[A-Z]{3,4}(USD|USDT|JPY|EUR|GBP|INR)$/.test(sym)
  );
}

export function toTradingViewSymbol(token: string | null | undefined): string {
  if (!token) return DEFAULT_TV_SYMBOL;
  const raw = decodeURIComponent(token);

  // Numeric Zerodha tokens — known indices map; otherwise fall back to NSE.
  if (/^\d+$/.test(raw)) {
    return ZERODHA_TOKEN_MAP[raw] ?? `NSE:${raw}`;
  }

  // Legacy synthetic prefixes
  if (SYNTHETIC_PREFIX_MAP[raw]) return SYNTHETIC_PREFIX_MAP[raw]!;

  if (raw.startsWith("FX_")) {
    const pair = raw.slice(3);
    return FOREX_MAP[pair] ?? `OANDA:${pair}`;
  }

  if (raw.startsWith("CRYPTO_")) {
    const pair = raw.slice(7);
    if (CRYPTO_MAP[pair]) return CRYPTO_MAP[pair]!;
    const base = pair.slice(0, -3);
    const quote = pair.slice(-3);
    const fixed = CRYPTO_QUOTE_FIX[quote] ?? quote;
    return `BINANCE:${base}${fixed}`;
  }

  if (raw.startsWith("MCX_FUT_")) {
    const name = raw.slice("MCX_FUT_".length);
    const trimmed = stripFutSuffix(name).replace(/^MCX/, "");
    return (
      METAL_ENERGY_MAP[trimmed] ??
      METAL_ENERGY_MAP[name] ??
      `TVC:${trimmed || name}`
    );
  }

  // Plain-symbol path — Infoway / Zerodha may send the symbol directly,
  // sometimes with a month/year/FUT suffix (e.g. "GOLD26DECFUT").
  const sym = normalise(raw);
  const baseSym = stripFutSuffix(sym).replace(/^MCX/, "");

  if (INDIAN_INDEX_MAP[sym]) return INDIAN_INDEX_MAP[sym]!;
  if (INDIAN_INDEX_MAP[baseSym]) return INDIAN_INDEX_MAP[baseSym]!;
  if (METAL_ENERGY_MAP[sym]) return METAL_ENERGY_MAP[sym]!;
  if (METAL_ENERGY_MAP[baseSym]) return METAL_ENERGY_MAP[baseSym]!;
  if (CRYPTO_MAP[sym]) return CRYPTO_MAP[sym]!;
  if (FOREX_MAP[sym]) return FOREX_MAP[sym]!;

  // Heuristic: 6-letter symbols ending in USD/USDT/JPY/EUR/GBP/INR → crypto
  // (if base is a known crypto) else forex.
  if (/^[A-Z]{3,4}(USD|USDT|JPY|EUR|GBP|INR)$/.test(sym)) {
    const baseLen = sym.length - 3;
    const base = sym.slice(0, baseLen);
    const quote = sym.slice(baseLen);
    if (CRYPTO_BASES.has(base)) {
      const fixed = CRYPTO_QUOTE_FIX[quote] ?? quote;
      return `BINANCE:${base}${fixed}`;
    }
    return `OANDA:${sym}`;
  }

  // Fallback: assume NSE equity. Stock tickers like TCS, SBIN, RELIANCE
  // resolve correctly here.
  return `NSE:${sym}`;
}
