// Frontend market-hours guard — mirrors `frontend-user/lib/marketHours.ts`.
// Used so the APK doesn't fire CLOSE / OPEN orders when the backend will
// obviously reject them with MARKET_CLOSED. Without this, clicking close
// or BUY/SELL outside trading hours triggered the same optimistic flow
// as a valid trade — the position briefly disappeared (or the green
// success toast briefly showed), then the server rejection rolled it
// back. The "1 sec ke liye trade close ho jata hai gayab ho jata hai"
// flicker the user kept reporting. This helper eliminates the flicker
// entirely: tap outside trading hours → single red toast, no optimistic
// mutation, no audio cue.

/** Minutes since IST midnight for the given JS Date. */
function _istMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/** IST day-of-week (0 = Sun, 6 = Sat). */
function _istDay(date: Date): number {
  const ist = new Date(date.getTime() + (5 * 60 + 30) * 60_000);
  return ist.getUTCDay();
}

/**
 * Returns true when the instrument's exchange is currently accepting
 * trades. `segmentType` is the canonical `Position.segment_type` value
 * the backend sends; `exchange` is a fallback when segment_type is
 * empty (legacy positions). Both are uppercased before matching.
 */
export function isInstrumentMarketOpen(
  segmentType?: string | null,
  exchange?: string | null,
  now: Date = new Date(),
): boolean {
  const seg = (segmentType || "").toUpperCase();
  const exch = (exchange || "").toUpperCase();
  const min = _istMinutes(now);
  const day = _istDay(now);
  const weekday = day !== 0 && day !== 6;

  // Crypto trades 24/7.
  if (seg.includes("CRYPTO") || exch === "CRYPTO" || exch === "BINANCE") return true;

  // International (Infoway-mirrored) — 24/5. Closed Sat all day and Sun
  // until ~21:00 IST (matches the international FX open window).
  if (
    seg === "FOREX" ||
    seg === "STOCKS" ||
    seg === "INDICES" ||
    seg === "COMMODITIES" ||
    seg.includes("FOREX") ||
    seg.includes("FX") ||
    exch === "CDS"
  ) {
    if (day === 6) return false;
    if (day === 0 && min < 21 * 60) return false;
    return true;
  }

  // MCX commodities: Mon-Fri 09:00 - 23:30 IST.
  if (seg.startsWith("MCX") || exch === "MCX") {
    if (!weekday) return false;
    return min >= 9 * 60 && min <= 23 * 60 + 30;
  }

  // NSE / BSE equity + F&O — Mon-Fri 09:15 - 15:30 IST. Catch-all.
  if (!weekday) return false;
  return min >= 9 * 60 + 15 && min <= 15 * 60 + 30;
}

/** Friendly label used in the "Market is closed" toast. */
export function marketLabel(
  segmentType?: string | null,
  exchange?: string | null,
): string {
  const seg = (segmentType || "").toUpperCase();
  const exch = (exchange || "").toUpperCase();
  if (seg.includes("CRYPTO") || exch === "CRYPTO") return "Crypto";
  if (seg === "FOREX" || seg.includes("FOREX") || seg.includes("FX") || exch === "CDS")
    return "Forex";
  if (seg === "COMMODITIES") return "Commodities";
  if (seg === "STOCKS") return "Global stocks";
  if (seg === "INDICES") return "Global indices";
  if (seg.startsWith("MCX") || exch === "MCX") return "MCX";
  if (seg.startsWith("BSE") || exch === "BSE") return "BSE";
  return "NSE";
}
