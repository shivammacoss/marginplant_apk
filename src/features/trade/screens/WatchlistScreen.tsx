import { useMemo, useState } from "react";
import { View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { Screen } from "@shared/components/Screen";
import { Text } from "@shared/ui/Text";
import { Chip } from "@shared/ui/Chip";
import { WatchlistHeader } from "@features/trade/components/WatchlistHeader";
import { StockRow } from "@features/trade/components/StockRow";
import { SearchFab } from "@features/trade/components/SearchFab";
import { IllustrationEmpty } from "@shared/components/IllustrationEmpty";
import { SketchIllustration } from "@shared/components/SketchIllustration";
import { useWatchlistStore } from "@features/trade/store/watchlist.store";
import { useTickers } from "@features/trade/hooks/useTickers";

const TABS = [
  { key: "mine", label: "My Lists" },
  { key: "scanners", label: "Stock Scanners" },
] as const;

export function WatchlistScreen() {
  const [tab, setTab] = useState<"mine" | "scanners">("mine");
  const symbols = useWatchlistStore((s) => s.symbols);
  const ticks = useTickers(symbols);

  const rows = useMemo(
    () =>
      symbols.map((sym) => {
        const t = ticks[sym];
        return {
          symbol: sym,
          name: sym,
          exchange: "NSE",
          ltp: t?.ltp ?? 0,
          change: t?.change ?? 0,
          changePct: t?.change_pct ?? 0,
        };
      }),
    [symbols, ticks],
  );

  if (tab === "scanners") {
    return (
      <Screen>
        <Text style={{ fontSize: 28, fontWeight: "700", paddingVertical: 8 }}>My Watchlist</Text>
        <View style={{ flexDirection: "row", gap: 10, paddingVertical: 8 }}>
          {TABS.map((t) => (
            <Chip key={t.key} label={t.label} active={t.key === tab} onPress={() => setTab(t.key)} />
          ))}
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text tone="muted">Open Search to use Gainers, Losers, Breakouts.</Text>
        </View>
        <SearchFab />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", paddingVertical: 8 }}>My Watchlist</Text>
        <View style={{ flexDirection: "row", gap: 10, paddingVertical: 8 }}>
          {TABS.map((t) => (
            <Chip key={t.key} label={t.label} active={t.key === tab} onPress={() => setTab(t.key)} />
          ))}
        </View>
      </View>
      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        <WatchlistHeader listName="My Stocks" onAdd={() => router.push("/search")} />
      </View>
      {rows.length === 0 ? (
        <IllustrationEmpty
          illustration={<SketchIllustration kind="clipboard" />}
          title="Your watchlist is empty"
          description="Tap + or Search & Add to track instruments."
        />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(it) => it.symbol}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 160 }}
          renderItem={({ item }) => (
            <StockRow
              symbol={item.symbol}
              name={item.name}
              exchange={item.exchange}
              ltp={item.ltp}
              change={item.change}
              changePct={item.changePct}
              onPress={() => router.push({ pathname: "/(tabs)/trade", params: { token: item.symbol } })}
            />
          )}
        />
      )}
      <SearchFab />
    </Screen>
  );
}
