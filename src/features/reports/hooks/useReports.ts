import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ReportsAPI, type DateRange } from "@features/reports/api/reports.api";

// `placeholderData: keepPreviousData` is the difference between a report
// page that "blinks to a loader on every refetch" and one that "always
// shows the last successful data, refetching silently in the background".
// Every consumer here pairs that with a sensible `staleTime` so the
// background refetch only fires when the data is actually stale —
// otherwise opening Statements / P&L / Tradebook / Tax repeatedly within
// the staleTime window paints instantly from cache.

export function usePnlReport(range: DateRange = {}) {
  return useQuery({
    queryKey: ["reports", "pnl", range],
    queryFn: () => ReportsAPI.pnl(range),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useTradebook(range: DateRange & { limit?: number } = {}) {
  return useQuery({
    queryKey: ["reports", "tradebook", range],
    queryFn: () => ReportsAPI.tradebook(range),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useBrokerageReport(range: DateRange = {}) {
  return useQuery({
    queryKey: ["reports", "brokerage", range],
    queryFn: () => ReportsAPI.brokerage(range),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useMarginReport() {
  return useQuery({
    queryKey: ["reports", "margin"],
    queryFn: () => ReportsAPI.margin(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useTaxReport(range: DateRange = {}) {
  return useQuery({
    queryKey: ["reports", "tax", range],
    queryFn: () => ReportsAPI.tax(range),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}
