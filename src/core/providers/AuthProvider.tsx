import { ReactNode, useEffect } from "react";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@features/auth/store/auth.store";
import { onAuthFailure } from "@core/api/client";
import { MarketwatchAPI } from "@features/trade/api/marketwatch.api";
import { marketdata } from "@features/trade/services/marketdata.service";
import { PositionsAPI } from "@features/portfolio/api/positions.api";
import { WalletAPI } from "@features/wallet/api/wallet.api";
import { OrdersAPI } from "@features/trade/api/orders.api";
import { OptionChainAPI } from "@features/trade/api/market.api";
import { ReportsAPI } from "@features/reports/api/reports.api";
import { LedgerAPI } from "@features/wallet/api/ledger.api";
import { fetchMarketNews, NEWS_QUERY_KEY } from "@features/trade/components/MarketNews";
import { fetchHistory, historyKey } from "@features/charts/hooks/useHistory";

// Indian indices that account for ~90 % of option-chain views. Pre-fetched
// on auth so the first tap on the chart's "Options" button paints from
// cache — same instant feel as Zerodha's "Chain" sheet.
const OPTION_CHAIN_PREFETCH = ["NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX"];

// Baseline tokens we always want streaming the moment auth lands, so the
// Home tab's indices strip and IntradayChartCard have live prices before
// the user even taps it. Mirrors HomeScreen's SEGMENT_TOKENS defaults.
const BOOT_TOKENS = [
  "256265", // NIFTY 50
  "260105", // NIFTY BANK
  "260617", // NIFTY 100
  "FX_EURUSD",
  "FX_USDINR",
  "CRYPTO_BTCUSD",
  "CRYPTO_ETHUSD",
];

interface Props {
  children: ReactNode;
}

export function AuthProvider({ children }: Props) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const signOut = useAuthStore((s) => s.signOut);
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const qc = useQueryClient();

  useEffect(() => {
    hydrate();
    onAuthFailure(() => {
      void signOut().then(() => router.replace("/(auth)/login"));
    });
  }, [hydrate, signOut]);

  // Prefetch the user's watchlist + its live quotes the moment auth lands
  // so the Market tab paints immediately when the user navigates to it —
  // no spinner, no blank rows, even on a cold start. React Query reuses
  // this cached fetch when MarketScreen's `useQuery` mounts.
  useEffect(() => {
    if (!isAuthed) return;
    void qc
      .fetchQuery({
        queryKey: ["marketwatch"],
        queryFn: () => MarketwatchAPI.list(),
        staleTime: 60_000,
      })
      .then((lists) => {
        const id = lists?.[0]?.id;
        if (!id) return;
        void qc.prefetchQuery({
          queryKey: ["watchlist-quotes", id],
          queryFn: () => MarketwatchAPI.quotes(id),
          staleTime: 2_000,
        });
        // Pre-subscribe every favourite token to the marketdata WS so
        // ticks start streaming before the user opens Market.
        const favTokens = (lists?.[0]?.items ?? [])
          .map((it) => String(it.token))
          .filter(Boolean);
        if (favTokens.length > 0) marketdata.subscribe(favTokens);
      })
      .catch(() => undefined);
  }, [isAuthed, qc]);

  // Subscribe the baseline Home / IndicesStrip tokens immediately on
  // auth — by the time the user lands on Home, the WS has already
  // delivered the first tick for NIFTY / BANKNIFTY / BTC / EUR.
  useEffect(() => {
    if (!isAuthed) return;
    marketdata.subscribe(BOOT_TOKENS);
    return () => marketdata.unsubscribe(BOOT_TOKENS);
  }, [isAuthed]);

  // Pre-warm Portfolio + Wallet + Orders queries on auth so the moment the
  // user taps any of those tabs the screen paints from cache — no centered
  // spinner, no "Loading…" delay. Each fetch runs in parallel and shares
  // its result with the corresponding `useQuery` consumer.
  useEffect(() => {
    if (!isAuthed) return;
    void Promise.allSettled([
      qc.prefetchQuery({
        queryKey: ["positions", "open"],
        queryFn: () => PositionsAPI.open(),
        staleTime: 2_000,
      }),
      qc.prefetchQuery({
        queryKey: ["positions", "closed"],
        queryFn: () => PositionsAPI.closed(),
        staleTime: 10_000,
      }),
      qc.prefetchQuery({
        queryKey: ["positions", "active-trades"],
        queryFn: () => PositionsAPI.activeTrades(),
        staleTime: 2_000,
      }),
      qc.prefetchQuery({
        queryKey: ["positions", "pnl-summary"],
        queryFn: () => PositionsAPI.pnlSummary(),
        staleTime: 3_000,
      }),
      qc.prefetchQuery({
        queryKey: ["wallet", "summary"],
        queryFn: () => WalletAPI.summary(),
        staleTime: 15_000,
      }),
      // `limit` MUST match OrdersScreen's `useOrders({ limit: 200 })` —
      // otherwise the prefetched cache lives under a different key and
      // OrdersScreen falls back to a fresh fetch on mount (the user's
      // "Orders me turant nahi aata" bug). Same `limit: 200` here keeps
      // both the prefetch AND optimistic order insertion writing to the
      // exact same cache entry the screen reads from.
      qc.prefetchQuery({
        queryKey: ["orders", "all", 200, 0],
        queryFn: () => OrdersAPI.list({ limit: 200 }),
        staleTime: 4_000,
      }),
      // Preload market news so the Home page's news block paints from
      // cache the moment the user lands on Home — no "Loading news…"
      // delay even on the first launch after auth.
      qc.prefetchQuery({
        queryKey: NEWS_QUERY_KEY,
        queryFn: fetchMarketNews,
        staleTime: 3 * 60_000,
      }),
      // Option-chain config (underlyings list, strikes-around-ATM cap).
      // Tiny payload — primes the underlying chips before the user opens
      // the option-chain sheet from any chart.
      qc.prefetchQuery({
        queryKey: ["option-chain", "config"],
        queryFn: () => OptionChainAPI.config(),
        staleTime: 5 * 60_000,
      }),
      // Statements (P&L) — the Profile screen's "Statements" entry. The
      // default empty-range fetch is what `usePnlReport()` runs, so this
      // prefetch lands under the exact same query key the screen reads
      // from → opens instantly with cached data, refetches silently in
      // the background after 60 s.
      qc.prefetchQuery({
        queryKey: ["reports", "pnl", {}],
        queryFn: () => ReportsAPI.pnl({}),
        staleTime: 60_000,
      }),
      // Tradebook — second-most-opened Statements sub-tab. Same logic.
      qc.prefetchQuery({
        queryKey: ["reports", "tradebook", {}],
        queryFn: () => ReportsAPI.tradebook({}),
        staleTime: 60_000,
      }),
      // Transaction history (wallet ledger). Pre-warms the Profile →
      // Transaction history screen + the same hook the Ledger tab uses.
      qc.prefetchQuery({
        queryKey: ["wallet", "transactions", 100, 0],
        queryFn: () => WalletAPI.transactions(100, 0),
        staleTime: 30_000,
      }),
      qc.prefetchQuery({
        queryKey: ["ledger", { limit: 100 }],
        queryFn: () => LedgerAPI.fetch({ limit: 100 }),
        staleTime: 30_000,
      }),
      // Index option chains — kick off in parallel so by the time the
      // user taps "Options" on a NIFTY / BANKNIFTY chart, the strike grid
      // is already in cache. `placeholderData: keepPreviousData` in
      // `useOptionChain` keeps the cached chain visible while the next
      // 2 s poll runs in the background.
      ...OPTION_CHAIN_PREFETCH.map((sym) =>
        qc.prefetchQuery({
          queryKey: ["option-chain", sym, ""],
          queryFn: () => OptionChainAPI.fetch(sym),
          staleTime: 2_500,
        }),
      ),
      // Chart history for the Trade-tab default (NIFTY 256265, 5m).
      // Opening the Trade tab is one of the slowest cold paths because
      // the WebView, the Lightweight Charts script, AND the history API
      // round-trip all run in parallel — and the user sees the chart
      // panel grey until the LAST of them returns. Pre-warming the
      // history here means by the time the WebView reports ready, the
      // bars are already sitting in `["history", "256265", "5"]` and the
      // chart paints in one frame.
      qc.prefetchQuery({
        queryKey: historyKey("256265", "5"),
        queryFn: () => fetchHistory("256265", "5"),
        staleTime: 60_000,
      }),
    ]);
  }, [isAuthed, qc]);

  return <>{children}</>;
}
