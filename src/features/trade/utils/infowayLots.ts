// Mirrors the backend's `infoway_lots.get_infoway_lot_size` for the most
// common Infoway-fed symbols. Used as a client-side fallback for the
// LOT ⇄ QTY toggle when the backend's `/segment-settings/effective`
// hasn't yet been restarted to resolve canonical lot sizes for
// crypto / forex (older deploys returned the stale Instrument
// `lot_size = 1`, which made conversion a no-op). The backend remains
// the authoritative source — this table is purely a defensive fallback
// so the toggle works the moment this OTA lands.
//
// Numbers below match `backend/app/services/infoway_lots.py` 1:1.

const CRYPTO_LOT_SIZE = 100;
const FOREX_LOT_SIZE = 100_000;
const SPOT_METAL_LOT_SIZE = 100;
const SPOT_ENERGY_LOT_SIZE = 1_000;

const KNOWN_LOTS: Record<string, number> = {
  // ── Crypto (100 units / lot) ───────────────────────────────────
  BTCUSD: CRYPTO_LOT_SIZE,
  ETHUSD: CRYPTO_LOT_SIZE,
  SOLUSD: CRYPTO_LOT_SIZE,
  XRPUSD: CRYPTO_LOT_SIZE,
  DOGEUSD: CRYPTO_LOT_SIZE,
  ADAUSD: CRYPTO_LOT_SIZE,
  AVAXUSD: CRYPTO_LOT_SIZE,
  DOTUSD: CRYPTO_LOT_SIZE,
  LINKUSD: CRYPTO_LOT_SIZE,
  LTCUSD: CRYPTO_LOT_SIZE,
  BNBUSD: CRYPTO_LOT_SIZE,
  MATICUSD: CRYPTO_LOT_SIZE,
  TRXUSD: CRYPTO_LOT_SIZE,
  SHIBUSD: CRYPTO_LOT_SIZE,
  // ── Forex (100,000 base units / standard lot) ─────────────────
  EURUSD: FOREX_LOT_SIZE,
  GBPUSD: FOREX_LOT_SIZE,
  USDJPY: FOREX_LOT_SIZE,
  USDINR: FOREX_LOT_SIZE,
  AUDUSD: FOREX_LOT_SIZE,
  NZDUSD: FOREX_LOT_SIZE,
  USDCAD: FOREX_LOT_SIZE,
  USDCHF: FOREX_LOT_SIZE,
  EURGBP: FOREX_LOT_SIZE,
  EURJPY: FOREX_LOT_SIZE,
  GBPJPY: FOREX_LOT_SIZE,
  EURINR: FOREX_LOT_SIZE,
  // ── Spot metals (100 oz / lot) ────────────────────────────────
  XAUUSD: SPOT_METAL_LOT_SIZE,
  XAGUSD: SPOT_METAL_LOT_SIZE,
  XPTUSD: SPOT_METAL_LOT_SIZE,
  XPDUSD: SPOT_METAL_LOT_SIZE,
  // ── Spot energy (1,000 barrels / lot) ─────────────────────────
  USOIL: SPOT_ENERGY_LOT_SIZE,
  UKOIL: SPOT_ENERGY_LOT_SIZE,
  NATGAS: SPOT_ENERGY_LOT_SIZE,
};

/**
 * Look up the contract size for an Infoway-fed instrument by symbol.
 * Strips common suffixes/prefixes the platform uses so e.g. `BTCUSDT`
 * (Binance pair) and `CRYPTO_BTCUSD` (legacy WS token prefix) both
 * resolve to the same `BTCUSD = 100` row.
 *
 * Returns null when the symbol isn't a known Infoway-fed instrument —
 * caller should fall back to whatever lot_size the backend provided
 * for native Indian segments (NSE / BSE / NFO / BFO / MCX).
 */
export function lookupInfowayLot(symbol: string | null | undefined): number | null {
  if (!symbol) return null;
  let s = symbol.toUpperCase().trim();
  // Strip legacy prefixes (`CRYPTO_BTCUSD`, `BINANCE:BTCUSDT`, `OANDA:EURUSD`).
  for (const pref of ["CRYPTO_", "BINANCE_", "BINANCE:", "OANDA:", "OANDA_", "FX_", "FOREX_", "TVC:"]) {
    if (s.startsWith(pref)) {
      s = s.slice(pref.length);
      break;
    }
  }
  // Trailing `T` on Binance crypto (BTCUSDT → BTCUSD) so we hit the
  // same canonical key.
  if (s.endsWith("USDT")) {
    const trimmed = s.slice(0, -1);
    if (KNOWN_LOTS[trimmed] != null) return KNOWN_LOTS[trimmed] ?? null;
  }
  return KNOWN_LOTS[s] ?? null;
}
