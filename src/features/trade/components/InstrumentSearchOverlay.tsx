import { memo, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radii, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { Chip } from "@shared/ui/Chip";
import { useDebounce } from "@shared/hooks/useDebounce";
import { InstrumentRow } from "@features/trade/components/InstrumentRow";
import { useInstrumentSearch } from "@features/trade/hooks/useInstrumentSearch";
import type { Instrument } from "@features/trade/types/instrument.types";

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface SegmentFilter {
  key: string;
  label: string;
  segment?: string;
  exchange?: string;
  matchRegex?: RegExp;
}

// Mirrors the segment filters on the standalone /search screen so the
// overlay version behaves identically — same backend search params,
// same matchRegex narrowing for metal / energy commodity sub-filters.
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

// Full-screen instrument search overlay. Same logic as the Market page's
// inline `useInstrumentSearch` flow + the standalone /search screen,
// packaged as a Modal so it can pop ON TOP of any host screen (Home,
// Chart, etc.) without forcing a route change. The user wanted the
// Market-style search experience surfaced from the Home top-bar pill
// AND the Chart screen's header magnifier — both used to route away
// to /search which broke their flow. This component is the unified
// surface; mount it once per host, toggle `visible` to open/close.
function InstrumentSearchOverlayImpl({ visible, onClose }: Props) {
  const [q, setQ] = useState("");
  const [segKey, setSegKey] = useState("all");
  const debouncedQ = useDebounce(q, 250);
  const insets = useSafeAreaInsets();

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

  function handleClose() {
    // Clear query on close so the next open starts fresh — keeps the
    // overlay feeling like a one-shot picker, not a sticky pane that
    // remembers what the user was looking for last time.
    setQ("");
    setSegKey("all");
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* ── Header row: back + search input + clear ──────────────── */}
        {/* paddingTop uses the device safe-area inset so the header
            clears the status bar / notch — the previous hardcoded
            `spacing["2xl"]` made the chip strip below ride too high
            on tall-notch devices and collide with the search pill. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 14,
            paddingTop: Math.max(insets.top, spacing.md) + 6,
            paddingBottom: 12,
            backgroundColor: colors.bg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              handleClose();
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
              borderRadius: radii.md,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search NIFTY, GOLD, BTCUSD, EURUSD…"
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, color: colors.text, fontSize: 14, padding: 0 }}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
            />
            {q.length > 0 ? (
              <Pressable onPress={() => setQ("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ── Segment chip filter ──────────────────────────────────── */}
        {/* Wrapped in a fixed-height, non-shrinking View so the
            horizontal ScrollView can't expand vertically and bleed
            into the search header above when the FlatList below
            scrolls. `flexGrow: 0` on the ScrollView keeps it sized
            to its content only. */}
        <View
          style={{
            height: 48,
            backgroundColor: colors.bg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{
              paddingHorizontal: 14,
              alignItems: "center",
              gap: 8,
            }}
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
        </View>

        {/* ── Results list ─────────────────────────────────────────── */}
        <FlatList
          style={{ flex: 1 }}
          data={rows}
          keyExtractor={(it) => it.token}
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 24) + 16,
          }}
          keyboardShouldPersistTaps="handled"
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
          renderItem={({ item }) => (
            <InstrumentRow
              token={item.token}
              symbol={item.symbol}
              name={item.name}
              exchange={item.exchange}
              onPress={() => {
                // Close the overlay FIRST so the navigation animation
                // plays over the host screen rather than the modal —
                // otherwise the chart route slides under the modal and
                // the user briefly sees both stacked.
                handleClose();
                router.push(
                  `/trade/chart?token=${encodeURIComponent(item.token)}`,
                );
              }}
            />
          )}
        />
      </View>
    </Modal>
  );
}

export const InstrumentSearchOverlay = memo(InstrumentSearchOverlayImpl);
