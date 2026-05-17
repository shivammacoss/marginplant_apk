import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Screen } from "@shared/components/Screen";
import { Text } from "@shared/ui/Text";
import { TopBar } from "@features/trade/components/TopBar";
import {
  SegmentTabs,
  type SegmentTab,
} from "@features/trade/components/SegmentTabs";
import { IndicesStrip, type IndexQuote } from "@features/trade/components/IndicesStrip";
import { IntradayChartCard } from "@features/trade/components/IntradayChartCard";
import { MarketOverview } from "@features/trade/components/MarketOverview";
import { MarketNews } from "@features/trade/components/MarketNews";
import { InstrumentSearchOverlay } from "@features/trade/components/InstrumentSearchOverlay";
import { useTickers } from "@features/trade/hooks/useTickers";
import { useTickerStore } from "@features/trade/store/ticker.store";

interface SegmentEntry {
  token: string;
  label: string;
}

// Per-tab top strips. Stocks shows Indian indices (Zerodha feed); Forex
// and Crypto pull from Infoway. Tokens match the prefixes the WS service
// already recognises (numeric Zerodha vs FX_* / CRYPTO_*).
const SEGMENT_TOKENS: Record<SegmentTab, SegmentEntry[]> = {
  Stocks: [
    { token: "256265", label: "NIFTY 50" },
    { token: "260105", label: "NIFTY BANK" },
    { token: "260617", label: "NIFTY 100" },
  ],
  Forex: [
    { token: "FX_EURUSD", label: "EUR / USD" },
    { token: "FX_GBPUSD", label: "GBP / USD" },
    { token: "FX_USDJPY", label: "USD / JPY" },
    { token: "FX_USDINR", label: "USD / INR" },
    { token: "FX_AUDUSD", label: "AUD / USD" },
  ],
  Crypto: [
    { token: "CRYPTO_BTCUSD", label: "BTC / USD" },
    { token: "CRYPTO_ETHUSD", label: "ETH / USD" },
    { token: "CRYPTO_SOLUSD", label: "SOL / USD" },
    { token: "CRYPTO_XRPUSD", label: "XRP / USD" },
    { token: "CRYPTO_DOGEUSD", label: "DOGE / USD" },
  ],
};

export function HomeScreen() {
  const [tab, setTab] = useState<SegmentTab>("Stocks");
  // Inline instrument-search modal — replaces the old router.push("/search")
  // that navigated away from Home. Same backend search logic the Market
  // page uses, just packaged as an overlay so the Home content stays
  // visible underneath.
  const [searchOpen, setSearchOpen] = useState(false);
  const entries = SEGMENT_TOKENS[tab];
  const tokens = useMemo(() => entries.map((e) => e.token), [entries]);
  const ticks = useTickers(tokens);

  const indices = useMemo<IndexQuote[]>(
    () =>
      entries.map((e) => {
        const t = ticks[e.token];
        return {
          symbol: e.label,
          token: e.token,
          ltp: t?.ltp ?? 0,
          change: t?.change ?? 0,
          changePct: t?.change_pct ?? 0,
        };
      }),
    [entries, ticks],
  );

  const primary = indices[0];
  const hasAnyTick = useMemo(
    () => entries.some((e) => ticks[e.token] != null),
    [entries, ticks],
  );
  const primaryEntry = useTickerStore((s) =>
    primary ? s.series[primary.token] : undefined,
  );

  // Market Overview + News are India-market-centric. Only render on the
  // Stocks tab; Forex / Crypto have their own feed sources covered by
  // the IndicesStrip + IntradayChartCard.
  const showIndianSections = tab === "Stocks";

  return (
    <Screen>
      <TopBar
        hasProfileBadge
        onSearch={() => setSearchOpen(true)}
      />
      <InstrumentSearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
      <SegmentTabs active={tab} onChange={setTab} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 8 }}
      >
        <IndicesStrip data={indices} />
        {primary ? (
          <IntradayChartCard
            symbol={primary.symbol}
            changePct={primary.changePct}
            data={primaryEntry?.values ?? []}
            startTs={primaryEntry?.startTs}
            endTs={primaryEntry?.endTs}
          />
        ) : null}
        {!hasAnyTick ? (
          <Text
            tone="dim"
            size="xs"
            style={{ textAlign: "center", marginTop: -8 }}
          >
            Connecting to live feed…
          </Text>
        ) : null}

        {showIndianSections ? (
          <>
            <MarketOverview />
            <MarketNews />
          </>
        ) : null}

        <View style={{ height: 8 }} />
      </ScrollView>
    </Screen>
  );
}
