import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Screen } from "@shared/components/Screen";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { Chip } from "@shared/ui/Chip";
import { goBack } from "@shared/utils/navigation";
import { useDebounce } from "@shared/hooks/useDebounce";
import { InstrumentRow } from "@features/trade/components/InstrumentRow";
import { useInstrumentSearch } from "@features/trade/hooks/useInstrumentSearch";
import { useWatchlistStore } from "@features/trade/store/watchlist.store";
import type { Instrument } from "@features/trade/types/instrument.types";

interface SegmentFilter {
  key: string;
  label: string;
  segment?: string;
  exchange?: string;
  matchRegex?: RegExp;
}

const SEGMENTS: SegmentFilter[] = [
  { key: "all", label: "All" },
  { key: "stocks", label: "Stocks", exchange: "NSE" },
  {
    key: "fno",
    label: "F&O",
    segment:
      "NFO-FUT,NSE_INDEX_OPTION_BUY,NSE_INDEX_OPTION_SELL,NSE_STOCK_OPTION_BUY,NSE_STOCK_OPTION_SELL",
  },
  { key: "forex", label: "Forex", segment: "CDS_FUTURE" },
  { key: "crypto", label: "Crypto", segment: "CRYPTO_SPOT" },
  {
    key: "metal",
    label: "Metal",
    segment: "MCX_FUTURE,MCX-FUT",
    matchRegex: /(GOLD|SILVER|COPPER|ZINC|ALUMINI|NICKEL|LEAD|PLATINUM)/i,
  },
  {
    key: "energy",
    label: "Energy",
    segment: "MCX_FUTURE,MCX-FUT",
    matchRegex: /(CRUDE|NATGAS|NATURALGAS|OIL)/i,
  },
  { key: "commodity", label: "All Commodity", segment: "MCX_FUTURE,MCX-FUT" },
];

export function SearchScreen() {
  const [q, setQ] = useState("");
  const [segKey, setSegKey] = useState("all");
  const debouncedQ = useDebounce(q, 250);
  const symbols = useWatchlistStore((s) => s.symbols);
  const addSym = useWatchlistStore((s) => s.add);
  const removeSym = useWatchlistStore((s) => s.remove);

  const watchSet = useMemo(() => new Set(symbols), [symbols]);
  const seg = SEGMENTS.find((s) => s.key === segKey) ?? SEGMENTS[0]!;

  const { data, isLoading } = useInstrumentSearch({
    q: debouncedQ,
    segment: seg.segment,
    exchange: seg.exchange,
    limit: 80,
  });

  const rows = useMemo<Instrument[]>(() => {
    const raw = data ?? [];
    if (!seg.matchRegex) return raw;
    return raw.filter(
      (it) =>
        seg.matchRegex!.test(it.symbol) ||
        seg.matchRegex!.test(it.name) ||
        seg.matchRegex!.test(it.trading_symbol ?? ""),
    );
  }, [data, seg]);

  return (
    <Screen padded={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            goBack("/trade/chart");
          }}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: colors.bgElevated,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search NIFTY, GOLD, BTCUSD, EURUSD…"
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, color: colors.text, fontSize: 15 }}
            autoFocus
            autoCapitalize="characters"
          />
          {q.length > 0 ? (
            <Pressable onPress={() => setQ("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 8 }}
      >
        {SEGMENTS.map((s) => (
          <Chip
            key={s.key}
            label={s.label}
            size="sm"
            active={s.key === segKey}
            onPress={() => {
              void Haptics.selectionAsync();
              setSegKey(s.key);
            }}
          />
        ))}
      </ScrollView>

      <FlatList
        data={rows}
        keyExtractor={(it) => it.token}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40 }}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <Text tone="muted">
                {q.length === 0 && segKey === "all"
                  ? "Type to search or pick a segment above"
                  : "No instruments found"}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const inList = watchSet.has(item.token);
          return (
            <InstrumentRow
              token={item.token}
              symbol={item.symbol}
              name={item.name}
              exchange={item.exchange}
              starred={inList}
              onToggleStar={() => (inList ? removeSym(item.token) : addSym(item.token))}
              onPress={() => router.replace(`/trade/${encodeURIComponent(item.token)}`)}
            />
          );
        }}
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}
