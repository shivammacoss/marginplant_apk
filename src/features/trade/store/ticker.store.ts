import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Tick } from "@features/trade/types/instrument.types";

const SPARK_MAX = 80;

interface SeriesEntry {
  values: number[];
  startTs: number;
  endTs: number;
}

interface TickerState {
  ticks: Record<string, Tick>;
  // Rolling LTP history per token — values + wall-clock bounds. Used by
  // the home-screen IntradayChartCard so the X-axis labels show real
  // times rather than indices.
  series: Record<string, SeriesEntry>;
  setTick: (t: Tick) => void;
  setManyTicks: (list: Tick[]) => void;
  clear: () => void;
}

function pushSeries(prev: SeriesEntry | undefined, ltp: number, ts: number): SeriesEntry {
  if (!Number.isFinite(ltp)) return prev ?? { values: [], startTs: ts, endTs: ts };
  const cur = prev?.values ?? [];
  if (cur.length > 0 && cur[cur.length - 1] === ltp) {
    return { values: cur, startTs: prev?.startTs ?? ts, endTs: ts };
  }
  if (cur.length < SPARK_MAX) {
    return {
      values: [...cur, ltp],
      startTs: prev?.startTs ?? ts,
      endTs: ts,
    };
  }
  return {
    values: [...cur.slice(cur.length - SPARK_MAX + 1), ltp],
    // We dropped the oldest sample → shift the window start forward
    // proportionally so the X-axis label stays in sync with the data.
    startTs: prev
      ? prev.startTs + (prev.endTs - prev.startTs) / SPARK_MAX
      : ts,
    endTs: ts,
  };
}

export const useTickerStore = create<TickerState>()(
  persist(
    (set) => ({
      ticks: {},
      series: {},

      setTick: (t) =>
        set((s) => {
          const prev = s.ticks[t.symbol];
          if (prev && prev.ts >= t.ts) return s;
          return {
            ticks: { ...s.ticks, [t.symbol]: t },
            series: {
              ...s.series,
              [t.symbol]: pushSeries(s.series[t.symbol], t.ltp, t.ts),
            },
          };
        }),

      setManyTicks: (list) =>
        set((s) => {
          const nextTicks = { ...s.ticks };
          const nextSeries = { ...s.series };
          for (const t of list) {
            const prev = nextTicks[t.symbol];
            if (!prev || prev.ts < t.ts) {
              nextTicks[t.symbol] = t;
              nextSeries[t.symbol] = pushSeries(nextSeries[t.symbol], t.ltp, t.ts);
            }
          }
          return { ticks: nextTicks, series: nextSeries };
        }),

      clear: () => set({ ticks: {}, series: {} }),
    }),
    {
      name: "ticker-cache.v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ ticks: s.ticks, series: s.series }),
      version: 3,
      migrate: () => ({
        // The series shape changed across versions; drop the old payload
        // rather than try to reconstruct it. Live ticks repopulate in
        // seconds.
        ticks: {},
        series: {},
      }),
    },
  ),
);

export const selectTick = (symbol: string) => (s: TickerState) => s.ticks[symbol];
export const selectSeries = (symbol: string) => (s: TickerState) => s.series[symbol];
