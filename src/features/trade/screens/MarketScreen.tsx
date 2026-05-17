import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@shared/components/Screen";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { useDebounce } from "@shared/hooks/useDebounce";
import { InstrumentRow } from "@features/trade/components/InstrumentRow";
import { useInstrumentSearch } from "@features/trade/hooks/useInstrumentSearch";
import { useTradeSheet } from "@features/trade/components/TradeSheetProvider";
import {
  MarketwatchAPI,
  SegmentSettingsAPI,
  type MarketwatchQuote,
  type SegmentItem,
} from "@features/trade/api/marketwatch.api";
import {
  useMarketwatchList,
  useCreateMarketwatch,
  useAddMarketwatchItem,
  useRemoveMarketwatchItem,
  useAddSegmentItem,
  useRemoveSegmentItem,
} from "@features/trade/hooks/useMarketwatch";
import { useUiStore } from "@shared/store/ui.store";
import { useTickerSubscription } from "@features/trade/hooks/useTickers";
import { useManualRefresh } from "@shared/hooks/useManualRefresh";
import type { Instrument } from "@features/trade/types/instrument.types";

// Mirrors the web's MobileInstrumentsBar bucket layout exactly. Indian
// segments first (NSE/BSE/MCX), then Infoway-fed international chips
// (Indices, Stocks, Commodities, Forex, Crypto).
interface Bucket {
  key: string;
  label: string;
  segments?: string[];
  adminRow?: string;
  managed?: boolean;
}

const BUCKETS: Bucket[] = [
  { key: "favorites", label: "Favorites" },
  { key: "nse_eq", label: "NSE EQ", segments: ["NSE_EQUITY"], adminRow: "NSE_EQ", managed: true },
  { key: "nse_fut", label: "NSE FUT", segments: ["NSE_FUTURE", "NSE_INDEX_FUTURE"], adminRow: "NSE_FUT", managed: true },
  { key: "nse_opt", label: "NSE OPT", segments: ["NSE_INDEX_OPTION_BUY", "NSE_INDEX_OPTION_SELL", "NSE_STOCK_OPTION_BUY", "NSE_STOCK_OPTION_SELL"], adminRow: "NSE_OPT", managed: true },
  { key: "bse_eq", label: "BSE EQ", segments: ["BSE_EQUITY"], adminRow: "BSE_EQ", managed: true },
  { key: "bse_fut", label: "BSE FUT", segments: ["BSE_FUTURE", "BSE_INDEX_FUTURE"], adminRow: "BSE_FUT", managed: true },
  { key: "bse_opt", label: "BSE OPT", segments: ["BSE_OPTION_BUY", "BSE_OPTION_SELL"], adminRow: "BSE_OPT", managed: true },
  { key: "mcx_fut", label: "MCX FUT", segments: ["MCX_FUTURE"], adminRow: "MCX_FUT", managed: true },
  { key: "mcx_opt", label: "MCX OPT", segments: ["MCX_OPTION_BUY", "MCX_OPTION_SELL"], adminRow: "MCX_OPT", managed: true },
  { key: "indices", label: "Indices", segments: ["INDICES"], adminRow: "INDICES" },
  { key: "stocks", label: "Stocks", segments: ["STOCKS"], adminRow: "STOCKS" },
  { key: "commodities", label: "Commodities", segments: ["COMMODITIES"], adminRow: "COMMODITIES" },
  { key: "forex", label: "Forex", segments: ["FOREX"], adminRow: "FOREX" },
  { key: "crypto", label: "Crypto", segments: ["CRYPTO_PERPETUAL", "CRYPTO_SPOT", "CRYPTO_FUTURE"], adminRow: "CRYPTO" },
];

export function MarketScreen() {
  const [q, setQ] = useState("");
  const [bucketKey, setBucketKey] = useState<string>("favorites");
  const debouncedQ = useDebounce(q, 200);
  const trade = useTradeSheet();
  const insets = useSafeAreaInsets();

  // Extra bottom padding so list rows never hide behind the bottom tab bar
  // (tab bar = 68 + bottomInset). Adding ~96 leaves room for the tab bar
  // plus a comfortable touch-safe margin.
  const listBottomPadding = 96 + insets.bottom;

  const { data: inactiveRows } = useQuery<string[]>({
    queryKey: ["segment-settings", "inactive"],
    queryFn: () => SegmentSettingsAPI.inactive(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const inactiveSet = useMemo(() => new Set(inactiveRows ?? []), [inactiveRows]);
  const visibleBuckets = useMemo(
    () =>
      BUCKETS.filter((b) => !b.adminRow || !inactiveSet.has(b.adminRow)),
    [inactiveSet],
  );

  const bucket =
    visibleBuckets.find((b) => b.key === bucketKey) ?? visibleBuckets[0]!;

  // Favourite-toggle helpers share one watchlist (the user's default one).
  // If the user has no watchlist yet, we auto-create "My Watchlist" the
  // first time they tap a star so the action never silently no-ops.
  const watchlists = useMarketwatchList();
  const activeWl = watchlists.data?.[0];
  // Backend's marketwatch payload mixes two field names depending on the
  // path: `token` for items added via the unified marketwatch endpoint,
  // `instrument_token` for items mirrored from the segment-watch list.
  // Reading both keeps the favourite-star yellow regardless of which
  // shape the server returned on the most recent refetch (without this
  // the star turned yellow optimistically and then flipped back to gray
  // when the server response landed — the user's bug).
  const favTokens = useMemo(() => {
    const s = new Set<string>();
    for (const it of activeWl?.items ?? []) {
      const t = it.token ?? it.instrument_token;
      if (t) s.add(String(t));
    }
    return s;
  }, [activeWl]);
  const addFav = useAddMarketwatchItem();
  const removeFav = useRemoveMarketwatchItem();
  const createWl = useCreateMarketwatch();
  const pushToast = useUiStore((s) => s.pushToast);
  const toggleFav = useCallback(
    async (token: string) => {
      void Haptics.selectionAsync();
      let id = activeWl?.id;
      if (!id) {
        // Watchlists query still loading — bail rather than create a dup.
        if (watchlists.isLoading) return;
        try {
          const created = await createWl.mutateAsync("My Watchlist");
          id = created.id;
        } catch {
          return;
        }
      }
      if (favTokens.has(token)) {
        removeFav.mutate({ id, token });
      } else {
        addFav.mutate({ id, token });
        pushToast({
          kind: "success",
          message: "Added to favorites",
          ttlMs: 1200,
        });
      }
    },
    [
      activeWl?.id,
      favTokens,
      addFav,
      removeFav,
      createWl,
      watchlists.isLoading,
      pushToast,
    ],
  );

  return (
    <Screen padded={false}>
      <Header />
      <SearchBar
        value={q}
        onChange={setQ}
        placeholder={`Search in ${bucket.label}`}
      />
      <BucketChips
        buckets={visibleBuckets}
        activeKey={bucket.key}
        onPick={(k) => {
          void Haptics.selectionAsync();
          setBucketKey(k);
          setQ("");
        }}
      />
      {bucket.key === "favorites" ? (
        <FavList
          q={debouncedQ}
          paddingBottom={listBottomPadding}
          onTap={(t, sym) => trade.open({ token: t, symbol: sym })}
          favTokens={favTokens}
          onToggleFav={toggleFav}
        />
      ) : bucket.managed ? (
        <ManagedSegmentList
          bucket={bucket}
          q={debouncedQ}
          paddingBottom={listBottomPadding}
          onTap={(t, sym, n) => trade.open({ token: t, symbol: sym, name: n })}
          favTokens={favTokens}
          onToggleFav={toggleFav}
        />
      ) : (
        <FeedSegmentList
          bucket={bucket}
          q={debouncedQ}
          paddingBottom={listBottomPadding}
          onTap={(t, sym, n) => trade.open({ token: t, symbol: sym, name: n })}
          favTokens={favTokens}
          onToggleFav={toggleFav}
        />
      )}
    </Screen>
  );
}

function Header() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 6,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "800", flex: 1 }}>Market</Text>
      <Pressable
        onPress={() => router.push("/wallet")}
        hitSlop={10}
        style={{ paddingHorizontal: 6 }}
      >
        <Ionicons name="wallet-outline" size={20} color={colors.text} />
      </Pressable>
      <Pressable onPress={() => router.push("/profile")} hitSlop={10}>
        <Ionicons name="person-outline" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 6 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: colors.bgElevated,
          borderRadius: 10,
          paddingHorizontal: 12,
          height: 40,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="search" size={15} color={colors.textMuted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, color: colors.text, fontSize: 13, padding: 0 }}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {value.length > 0 ? (
          <Pressable onPress={() => onChange("")} hitSlop={8}>
            <Ionicons name="close-circle" size={15} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function BucketChips({
  buckets,
  activeKey,
  onPick,
}: {
  buckets: Bucket[];
  activeKey: string;
  onPick: (k: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, maxHeight: 42 }}
      contentContainerStyle={{
        paddingHorizontal: 14,
        paddingVertical: 6,
        gap: 8,
        alignItems: "center",
      }}
      keyboardShouldPersistTaps="handled"
    >
      {buckets.map((b) => {
        const active = b.key === activeKey;
        return (
          <Pressable key={b.key} onPress={() => onPick(b.key)}>
            <View
              style={{
                paddingHorizontal: 14,
                height: 30,
                justifyContent: "center",
                borderRadius: 999,
                backgroundColor: active ? colors.text : colors.bgElevated,
                borderWidth: 1,
                borderColor: active ? colors.text : colors.border,
              }}
            >
              <Text
                size="sm"
                style={{
                  color: active ? colors.textInverse : colors.text,
                  fontWeight: "700",
                  fontSize: 12,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {b.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

interface ListProps {
  q: string;
  paddingBottom: number;
  onTap: (token: string, symbol: string, name?: string) => void;
  favTokens: Set<string>;
  onToggleFav: (token: string) => void;
}

function FavList({
  q,
  paddingBottom,
  onTap,
  favTokens,
  onToggleFav,
}: ListProps) {
  const watchlists = useMarketwatchList();
  const activeWl = watchlists.data?.[0];
  // `placeholderData: keepPreviousData` keeps the last successful quote
  // snapshot painted on screen while the refetch lands — no "loading" gap
  // when the user pops back into Market.
  const quotes = useQuery<MarketwatchQuote[]>({
    queryKey: ["watchlist-quotes", activeWl?.id],
    queryFn: () => MarketwatchAPI.quotes(activeWl!.id),
    enabled: !!activeWl?.id,
    // Aggressive 1.5 s poll as the FALLBACK path — WS pushes ticks live
    // (instant updates) but this REST poll is the safety net when the
    // backend's Zerodha/Infoway WS isn't streaming (e.g. 403 / restart
    // in flight). Tighter interval = users see prices move within 1-2 s
    // even on degraded WS. Backend `/marketwatch/quotes` is in-memory
    // cached on the server side so the extra poll cost is negligible.
    refetchInterval: 1_500,
    staleTime: 1_000,
    placeholderData: (prev) => prev,
  });

  // Subscribe the WS to every token we know about — even from a stale
  // cached watchlist — the moment the screen mounts. That way live ticks
  // start flowing before the REST `/quotes` round-trip lands, so the
  // user sees a price update within ~50 ms of opening the tab.
  const watchlistTokens = useMemo(
    () => (activeWl?.items ?? []).map((it) => String(it.token)),
    [activeWl?.items],
  );
  useTickerSubscription(watchlistTokens);

  const rows = useMemo(() => {
    const all = quotes.data ?? [];
    if (!q.trim()) return all;
    const Q = q.trim().toUpperCase();
    return all.filter(
      (r) =>
        r.symbol?.toUpperCase().includes(Q) ||
        r.name?.toUpperCase().includes(Q),
    );
  }, [quotes.data, q]);

  // `watchlistTokens` above already subscribed the full set; nothing to
  // do here on the filtered rows.

  // Manual-pull spinner. MUST be called before any early-return below —
  // otherwise on a search that resolves to zero matches the empty-state
  // return runs before this hook on the SECOND render, the hook count
  // drops, and React throws "Rendered fewer hooks than expected"
  // (the crash the user hit when searching for a non-favourited symbol).
  const { refreshing: manualRefreshing, onRefresh: handleManualRefresh } =
    useManualRefresh(async () => {
      await quotes.refetch();
    });

  if (!activeWl && !watchlists.isLoading) {
    return (
      <EmptyState
        icon="star-outline"
        title="No watchlist yet"
        hint="Tap the star on any instrument to add it here."
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="star-outline"
        title={q ? "No favorites match your search" : "No favorites yet"}
        hint={q ? undefined : "Switch to a section, search for a stock, and tap the star to add."}
      />
    );
  }

  return (
    <FlashList
      data={rows}
      keyExtractor={(r) => r.token}
      contentContainerStyle={{ paddingHorizontal: 14, paddingBottom }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={manualRefreshing}
          onRefresh={handleManualRefresh}
          tintColor={colors.textMuted}
        />
      }
      renderItem={({ item }) => (
        <InstrumentRow
          token={item.token}
          symbol={item.symbol}
          name={item.name || item.symbol}
          exchange={item.exchange ?? ""}
          ltp={item.ltp}
          // Pass REST bid/ask so the stacked bid/ask pair shows a number
          // even before the first WS tick lands on this row. Live ticks
          // replace these the moment the WS delivers depth.
          bid={item.bid}
          ask={item.ask}
          change={item.change}
          changePct={item.change_pct}
          starred={favTokens.has(item.token)}
          onToggleStar={() => onToggleFav(item.token)}
          onPress={() => onTap(item.token, item.symbol)}
        />
      )}
    />
  );
}

interface ManagedListProps extends ListProps {
  bucket: Bucket;
}

function ManagedSegmentList({
  bucket,
  q,
  paddingBottom,
  onTap,
  favTokens,
  onToggleFav,
}: ManagedListProps) {
  // Always-enabled so `addedTokens` stays accurate while the user is
  // searching — otherwise the "+" would re-appear on already-added items.
  // placeholderData paints the cached list immediately on every tab swap.
  const items = useQuery<SegmentItem[]>({
    queryKey: ["segment-items", bucket.adminRow],
    queryFn: () => MarketwatchAPI.segmentItems(bucket.adminRow!),
    enabled: !!bucket.adminRow,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  const search = useInstrumentSearch({
    q,
    segment: bucket.segments?.join(","),
    limit: 80,
  });
  const addSegment = useAddSegmentItem();
  const removeSegment = useRemoveSegmentItem();

  const showingSearch = q.trim().length > 0;
  const curatedRows = items.data ?? [];
  const searchRows = search.data ?? [];

  // Tokens currently in the curated list — used to suppress the "+" on
  // search results that are already added.
  const addedTokens = useMemo(() => {
    const s = new Set<string>();
    for (const it of curatedRows) s.add(String(it.instrument_token));
    return s;
  }, [curatedRows]);

  const rows = showingSearch ? searchRows : curatedRows;

  // ── Viewable-row token subscription ────────────────────────────────
  // Previously we subscribed the WS to EVERY token in `rows` — 80
  // results from a search, of which the user actually sees ~10-15 in
  // the viewport. The backend pump (now parallelised) still has to
  // refresh every subscribed token's overlay every 250 ms, so
  // 80-tokens-subscribed-when-only-15-visible is 5× more work than
  // necessary AND scales the round-trip JSON payload with it.
  //
  // FlashList's `onViewableItemsChanged` fires whenever a row scrolls
  // into / out of the configured visibility threshold. We track the
  // visible token set in a ref (no re-render per scroll tick) and pass
  // it to `useTickerSubscription`. Initial paint seeds with the first
  // 20 tokens so the user sees prices the instant the list mounts —
  // viewability events fire AFTER the first frame paints, so seeding
  // is what removes the "blank prices for 1 frame on every search"
  // flicker.
  const [visibleTokens, setVisibleTokens] = useState<string[]>([]);
  const allTokens = useMemo(
    () =>
      rows.map((r) =>
        "instrument_token" in r && r.instrument_token
          ? String(r.instrument_token)
          : String((r as Instrument).token),
      ),
    [rows],
  );
  // Seed with top-N so the visible-prices flow doesn't wait for the
  // first viewability event (which can be 100-200 ms after mount on
  // slow Android devices).
  const seededTokens = useMemo(
    () => allTokens.slice(0, 20),
    [allTokens.join(",")], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const subscribedTokens =
    visibleTokens.length > 0 ? visibleTokens : seededTokens;
  useTickerSubscription(subscribedTokens);

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 25,
      minimumViewTime: 50,
    }),
    [],
  );
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: SegmentItem | Instrument }> }) => {
      const next: string[] = [];
      for (const v of viewableItems) {
        const it = v.item;
        const t =
          "instrument_token" in it && it.instrument_token
            ? String(it.instrument_token)
            : String((it as Instrument).token);
        if (t) next.push(t);
      }
      setVisibleTokens(next);
    },
  ).current;

  if (rows.length === 0) {
    if (showingSearch && search.isLoading) return <LoaderRow />;
    if (!showingSearch && items.isLoading) return <LoaderRow />;
    return (
      <EmptyState
        icon="cube-outline"
        title={
          showingSearch
            ? "No instruments match"
            : `No ${bucket.label} added yet`
        }
        hint={
          showingSearch
            ? "Try a different symbol."
            : "Search above and tap + to add instruments to this list."
        }
      />
    );
  }

  return (
    <FlashList
      data={rows as (SegmentItem | Instrument)[]}
      keyExtractor={(it) =>
        "instrument_token" in it && it.instrument_token
          ? String(it.instrument_token)
          : String((it as Instrument).token)
      }
      contentContainerStyle={{ paddingHorizontal: 14, paddingBottom }}
      keyboardShouldPersistTaps="handled"
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      renderItem={({ item }) => {
        const token =
          "instrument_token" in item && item.instrument_token
            ? String(item.instrument_token)
            : String((item as Instrument).token);
        const symbol = item.symbol;
        const name = (item as Instrument).name ?? (item as SegmentItem).name ?? "";
        const exchange = item.exchange ?? "";
        const alreadyAdded = addedTokens.has(token);
        // Search results get a "+" (or none if already added). Curated
        // rows get an "x" so the user can drop instruments from the list.
        const trailing: "add" | "remove" | null = showingSearch
          ? alreadyAdded
            ? null
            : "add"
          : "remove";
        const onTrailing = () => {
          void Haptics.selectionAsync();
          if (trailing === "add") {
            addSegment.mutate({ segment: bucket.adminRow!, token });
          } else if (trailing === "remove") {
            removeSegment.mutate({ segment: bucket.adminRow!, token });
          }
        };
        return (
          <InstrumentRow
            token={token}
            symbol={symbol}
            name={name || symbol}
            exchange={exchange}
            starred={favTokens.has(token)}
            onToggleStar={() => onToggleFav(token)}
            trailing={trailing}
            onTrailing={onTrailing}
            onPress={() => onTap(token, symbol, name)}
          />
        );
      }}
    />
  );
}

interface FeedListProps extends ListProps {
  bucket: Bucket;
}

function FeedSegmentList({
  bucket,
  q,
  paddingBottom,
  onTap,
  favTokens,
  onToggleFav,
}: FeedListProps) {
  const { data, isLoading } = useInstrumentSearch({
    q,
    segment: bucket.segments?.join(","),
    limit: 120,
  });
  const rows = data ?? [];
  // Viewable-only WS subscription — see ManagedSegmentList for the
  // full rationale. 120-result feeds (FOREX / CRYPTO / INDICES) were
  // subscribing every token to the backend pump, which then refreshed
  // each of them every 250 ms even though the user could only see
  // ~15 rows at a time.
  const allTokens = useMemo(() => rows.map((r) => String(r.token)), [rows]);
  const [visibleTokens, setVisibleTokens] = useState<string[]>([]);
  const seededTokens = useMemo(
    () => allTokens.slice(0, 20),
    [allTokens.join(",")], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const subscribedTokens =
    visibleTokens.length > 0 ? visibleTokens : seededTokens;
  useTickerSubscription(subscribedTokens);
  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 25, minimumViewTime: 50 }),
    [],
  );
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: Instrument }> }) => {
      const next: string[] = [];
      for (const v of viewableItems) {
        const t = String(v.item?.token ?? "");
        if (t) next.push(t);
      }
      setVisibleTokens(next);
    },
  ).current;

  if (rows.length === 0) {
    if (isLoading) return <LoaderRow />;
    return (
      <EmptyState
        icon="cube-outline"
        title="No instruments found"
        hint={q ? "Try a different symbol." : `${bucket.label} feed is empty.`}
      />
    );
  }

  return (
    <FlashList
      data={rows}
      keyExtractor={(it) => it.token}
      contentContainerStyle={{ paddingHorizontal: 14, paddingBottom }}
      keyboardShouldPersistTaps="handled"
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      renderItem={({ item }) => (
        <InstrumentRow
          token={item.token}
          symbol={item.symbol}
          name={item.name}
          exchange={item.exchange}
          starred={favTokens.has(item.token)}
          onToggleStar={() => onToggleFav(item.token)}
          onPress={() => onTap(item.token, item.symbol, item.name)}
        />
      )}
    />
  );
}

function LoaderRow() {
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            opacity: 0.6 - i * 0.06,
          }}
        >
          <View style={{ flex: 1, gap: 6 }}>
            <View
              style={{
                width: 80,
                height: 14,
                borderRadius: 4,
                backgroundColor: colors.bgElevated,
              }}
            />
            <View
              style={{
                width: 130,
                height: 10,
                borderRadius: 4,
                backgroundColor: colors.bgElevated,
              }}
            />
          </View>
          <View style={{ gap: 6, alignItems: "flex-end" }}>
            <View
              style={{
                width: 70,
                height: 14,
                borderRadius: 4,
                backgroundColor: colors.bgElevated,
              }}
            />
            <View
              style={{
                width: 40,
                height: 10,
                borderRadius: 4,
                backgroundColor: colors.bgElevated,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
}) {
  return (
    <View
      style={{
        paddingVertical: 60,
        alignItems: "center",
        gap: 6,
      }}
    >
      <Ionicons name={icon} size={28} color={colors.textDim} />
      <Text style={{ fontWeight: "600", marginTop: 4 }}>{title}</Text>
      {hint ? (
        <Text
          tone="muted"
          size="sm"
          style={{ textAlign: "center", marginHorizontal: 24 }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
