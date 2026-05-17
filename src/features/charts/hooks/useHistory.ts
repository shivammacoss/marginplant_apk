import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { env } from "@core/config/env";
import { getAccessToken } from "@core/api/tokens";

export type ChartInterval = "1" | "5" | "15" | "60" | "1D";

export interface LWCBar {
  time: number; // epoch seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

const INTERVAL_TO_API: Record<ChartInterval, string> = {
  "1": "minute",
  "5": "5minute",
  "15": "15minute",
  "60": "60minute",
  "1D": "day",
};

// Lookback window per interval — sized to give the user a comfortable
// scroll buffer of *previous* candles (not just the few that fit on
// screen). 5m was previously 5 days (≈375 NSE candles), which felt
// empty on Forex / Crypto / fresh option contracts; widening to 15 days
// gives ~3 weeks of intraday context. Backend `/history` caps the
// `days` query at 365, so values are kept ≤ 365.
const DAYS_FOR_INTERVAL: Record<ChartInterval, number> = {
  "1": 7,
  "5": 15,
  "15": 30,
  "60": 90,
  "1D": 365,
};

// Public export so other chart components (NativeChart) can use the
// same lookback table instead of hardcoding `days: 5`.
export function daysForInterval(interval: ChartInterval): number {
  return DAYS_FOR_INTERVAL[interval];
}

interface BackendCandle {
  date?: string;
  time?: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

function toEpochSec(c: BackendCandle): number | null {
  if (c.date) {
    const t = Date.parse(c.date);
    if (Number.isFinite(t)) return Math.floor(t / 1000);
  }
  if (c.time != null) {
    const n = typeof c.time === "string" ? Number(c.time) : c.time;
    if (Number.isFinite(n)) return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
  }
  return null;
}

function normalise(candles: BackendCandle[]): LWCBar[] {
  const out: LWCBar[] = [];
  for (const c of candles) {
    const t = toEpochSec(c);
    if (t == null) continue;
    out.push({ time: t, open: c.open, high: c.high, low: c.low, close: c.close });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

export async function fetchHistory(token: string, interval: ChartInterval): Promise<LWCBar[]> {
  const jwt = getAccessToken();
  if (!jwt) return [];
  const url =
    `${env.API_URL}/api/v1/user/instruments/${encodeURIComponent(token)}/history` +
    `?interval=${INTERVAL_TO_API[interval]}&days=${DAYS_FOR_INTERVAL[interval]}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: BackendCandle[] };
  return normalise(body?.data ?? []);
}

export function historyKey(token: string, interval: ChartInterval) {
  return ["history", token, interval] as const;
}

// Candles change slowly relative to ticks — 60 s stale time is enough to
// keep repeated chart opens instant while still pulling a fresh window
// when the user has been idle. `gcTime` keeps the cache warm for 5 min
// even after the chart unmounts so navigating Market → Option-chain →
// back-to-chart paints from memory.
export function useHistory(token: string | null | undefined, interval: ChartInterval) {
  return useQuery<LWCBar[]>({
    queryKey: historyKey(token ?? "", interval),
    queryFn: () => fetchHistory(token as string, interval),
    enabled: !!token,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    // Keep the previous interval's candles painted while the new
    // interval is fetching — without this the chart blanks for a
    // beat on every timeframe tap and the user thinks the button
    // didn't work.
    placeholderData: keepPreviousData,
  });
}

/**
 * Imperative prefetch — call this from a row tap or hover *before*
 * navigating to ChartScreen so the candles are already cached by the
 * time the WebView mounts. The chart then paints in one frame instead
 * of "blank → spinner → candles" after the HTTP round-trip.
 */
export function usePrefetchHistory() {
  const qc = useQueryClient();
  return (token: string, interval: ChartInterval = "5") => {
    void qc.prefetchQuery({
      queryKey: historyKey(token, interval),
      queryFn: () => fetchHistory(token, interval),
      staleTime: 60_000,
    });
  };
}
