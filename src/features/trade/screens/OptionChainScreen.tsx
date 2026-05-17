import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@shared/components/Screen";
import { colors, radii } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { goBack } from "@shared/utils/navigation";
import {
  useOptionChain,
  useOptionChainConfig,
} from "@features/trade/hooks/useOptionChain";
import { useTickerStore } from "@features/trade/store/ticker.store";
import { usePriceFlash } from "@features/trade/hooks/usePriceFlash";
import { formatINR, formatNumber, formatSigned } from "@shared/utils/format";
import type {
  OptionLeg,
  OptionRow,
} from "@features/trade/types/option-chain.types";

const ROW_HEIGHT = 64;

// Default underlying chips shown above the chain. Falls back to a sensible
// list of liquid Indian indices when the backend /option-chain/config endpoint
// hasn't responded yet (or doesn't exist in this deployment). Real data still
// flows through useOptionChain — these chips just drive the underlying filter.
const FALLBACK_UNDERLYINGS = [
  { label: "Nifty", symbol: "NIFTY", color: "#2DD4BF" },
  { label: "BankNifty", symbol: "BANKNIFTY", color: "#A855F7" },
  { label: "FinNifty", symbol: "FINNIFTY", color: "#2DD4BF" },
  { label: "Sensex", symbol: "SENSEX", color: "#60A5FA" },
] as const;

function fmtExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtExpiryShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// Defensive normaliser — strips TradingView-only suffixes so older / stale
// deep-links like "/option-chain/NIFTY1!" still resolve to "NIFTY".
function normaliseUnderlying(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/1!$/, "")
    .replace(/_50$/, "")
    .trim();
}

export function OptionChainScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const initialUnderlying = normaliseUnderlying(
    decodeURIComponent(symbol ?? "NIFTY"),
  );

  const [underlying, setUnderlying] = useState<string>(initialUnderlying);
  const [expiry, setExpiry] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);

  const config = useOptionChainConfig();
  const chain = useOptionChain(underlying, expiry);

  const underlyings = useMemo(() => {
    const fromCfg = config.data?.underlyings ?? [];
    if (fromCfg.length > 0) return fromCfg;
    return FALLBACK_UNDERLYINGS as unknown as typeof fromCfg;
  }, [config.data?.underlyings]);

  const data = chain.data;
  const expiries = data?.expiries ?? [];
  const activeExpiry = expiry ?? data?.expiry ?? expiries[0] ?? null;
  const allRows = data?.rows ?? [];
  // Default to true when the backend doesn't send the flag (older deploys),
  // so we don't accidentally hide the change pill in active sessions.
  const marketOpen = data?.market_open !== false;

  const rows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.trim().toLowerCase();
    return allRows.filter((r) =>
      String(r.strike).toLowerCase().includes(q),
    );
  }, [allRows, search]);

  const atmIdx = useMemo(() => {
    if (rows.length === 0) return -1;
    if (data?.atm_strike != null) {
      const i = rows.findIndex((r) => r.strike === data.atm_strike);
      if (i >= 0) return i;
    }
    return Math.floor(rows.length / 2);
  }, [rows, data?.atm_strike]);

  // Reset expiry when underlying changes.
  const prevUnderlying = useRef(underlying);
  useEffect(() => {
    if (prevUnderlying.current !== underlying) {
      setExpiry(null);
      prevUnderlying.current = underlying;
    }
  }, [underlying]);

  const isInitialLoad = chain.isLoading && allRows.length === 0;

  return (
    <Screen padded={false}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Pressable hitSlop={10} onPress={() => goBack("/(tabs)")}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 17, fontWeight: "700" }}>{underlying}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 1, gap: 6 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: !marketOpen
                  ? colors.textMuted
                  : chain.isFetching
                  ? colors.warn
                  : colors.buy,
              }}
            />
            <Text tone="muted" size="xs">
              {!marketOpen
                ? "Market closed"
                : chain.isFetching
                ? "Updating…"
                : "Live"}
            </Text>
          </View>
        </View>
        {data?.spot != null ? (
          <View style={{ alignItems: "flex-end" }}>
            <Text tone="dim" size="xs">
              SPOT
            </Text>
            <Text mono style={{ fontSize: 15, fontWeight: "700" }}>
              {formatNumber(data.spot, 2)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.bgElevated,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
            height: 40,
          }}
        >
          <Ionicons name="search" size={15} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search strike price"
            placeholderTextColor={colors.textDim}
            keyboardType="numeric"
            style={{
              flex: 1,
              color: colors.text,
              fontSize: 13,
              padding: 0,
              marginLeft: 8,
            }}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={15} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Underlying chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, height: 44 }}
        contentContainerStyle={{ paddingHorizontal: 12, alignItems: "center" }}
      >
        {underlyings.map((u) => (
          <UnderlyingChip
            key={u.symbol}
            label={u.label}
            active={u.symbol === underlying}
            color={u.color}
            onPress={() => setUnderlying(u.symbol)}
          />
        ))}
      </ScrollView>

      {/* Expiry pill */}
      {expiries.length > 0 ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
          <Pressable onPress={() => setShowExpiryPicker((v) => !v)}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-start",
                backgroundColor: colors.bgElevated,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 12,
                height: 32,
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={13}
                color={colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={{ fontSize: 13, fontWeight: "600" }}>
                {activeExpiry ? fmtExpiry(activeExpiry) : "Expiry"}
              </Text>
              <Ionicons
                name={showExpiryPicker ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.textMuted}
                style={{ marginLeft: 6 }}
              />
            </View>
          </Pressable>
          {showExpiryPicker ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, height: 40, marginTop: 8 }}
              contentContainerStyle={{ alignItems: "center" }}
            >
              {expiries.map((e) => {
                const active = e === activeExpiry;
                return (
                  <Pressable
                    key={e}
                    onPress={() => {
                      setExpiry(e);
                      setShowExpiryPicker(false);
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 12,
                        height: 30,
                        justifyContent: "center",
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active
                          ? "rgba(168,85,247,0.15)"
                          : colors.bgElevated,
                        marginRight: 8,
                      }}
                    >
                      <Text
                        size="xs"
                        style={{
                          color: active ? colors.primary : colors.textMuted,
                          fontWeight: "600",
                        }}
                      >
                        {fmtExpiryShort(e)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      {/* CE | STRIKE | PE column header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgElevated,
        }}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 22,
              height: 18,
              borderRadius: 4,
              backgroundColor: colors.buy,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text size="xs" style={{ color: "#fff", fontWeight: "800", fontSize: 10 }}>
              CE
            </Text>
          </View>
          <Text size="xs" tone="dim" style={{ fontWeight: "600", letterSpacing: 0.5 }}>
            CALL
          </Text>
        </View>
        <Text
          size="xs"
          style={{
            width: 80,
            textAlign: "center",
            color: colors.textMuted,
            fontWeight: "700",
            letterSpacing: 0.8,
          }}
        >
          STRIKE
        </Text>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
          <Text size="xs" tone="dim" style={{ fontWeight: "600", letterSpacing: 0.5 }}>
            PUT
          </Text>
          <View
            style={{
              width: 22,
              height: 18,
              borderRadius: 4,
              backgroundColor: colors.sell,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text size="xs" style={{ color: "#fff", fontWeight: "800", fontSize: 10 }}>
              PE
            </Text>
          </View>
        </View>
      </View>

      {/* Rows */}
      <View style={{ flex: 1 }}>
        {isInitialLoad ? (
          <SkeletonList />
        ) : chain.isError ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.sell} />
            <Text tone="sell" size="sm" style={{ marginTop: 6 }}>
              {(chain.error as Error)?.message ?? "Couldn't load option chain"}
            </Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
            <Text tone="muted" size="sm" style={{ marginTop: 6 }}>
              {search
                ? `No strikes match "${search}"`
                : `No options available for ${underlying}`}
            </Text>
          </View>
        ) : (
          <FlashList
            data={rows}
            keyExtractor={(r) => String(r.strike)}
            renderItem={({ item, index }) => (
              <StrikeRow
                row={item}
                isAtm={index === atmIdx}
                spot={data?.spot ?? null}
                showChange={marketOpen}
              />
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
            initialScrollIndex={atmIdx > 4 ? atmIdx - 4 : 0}
          />
        )}
      </View>
    </Screen>
  );
}

function UnderlyingChip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          height: 32,
          borderRadius: 999,
          backgroundColor: active ? colors.text : colors.bgElevated,
          borderWidth: 1,
          borderColor: active ? colors.text : colors.border,
          marginRight: 8,
        }}
      >
        {color ? (
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: color,
              marginRight: 6,
            }}
          />
        ) : null}
        <Text
          size="sm"
          style={{
            color: active ? colors.textInverse : colors.text,
            fontWeight: "600",
            fontSize: 13,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

interface StrikeRowProps {
  row: OptionRow;
  isAtm: boolean;
  spot: number | null;
  showChange: boolean;
}

const StrikeRow = memo(function StrikeRow({ row, isAtm, spot, showChange }: StrikeRowProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        height: ROW_HEIGHT,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: isAtm ? "rgba(168,85,247,0.10)" : "transparent",
      }}
    >
      <LegCell leg={row.ce} side="CE" showChange={showChange} />
      <View
        style={{
          width: 80,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: radii.sm,
            backgroundColor: isAtm ? colors.primary : "transparent",
            borderWidth: isAtm ? 0 : 1,
            borderColor: colors.border,
          }}
        >
          <Text
            mono
            style={{
              color: isAtm ? "#fff" : colors.text,
              fontSize: 13,
              fontWeight: "800",
            }}
          >
            {row.strike.toLocaleString("en-IN")}
          </Text>
        </View>
        {isAtm && spot != null ? (
          <Text size="xs" tone="dim" style={{ fontSize: 9, marginTop: 2, fontWeight: "600" }}>
            ATM
          </Text>
        ) : null}
      </View>
      <LegCell leg={row.pe} side="PE" showChange={showChange} />
    </View>
  );
});

const LegCell = memo(function LegCell({
  leg,
  side,
  showChange,
}: {
  leg: OptionLeg | null;
  side: "CE" | "PE";
  showChange: boolean;
}) {
  const wsTick = useTickerStore((s) =>
    leg?.token ? s.ticks[String(leg.token)] : undefined,
  );

  // WS gives live ticks while market open; REST leg.ltp keeps the last
  // traded price visible after market close so the user still sees value.
  const liveLtp = wsTick?.ltp ?? leg?.ltp ?? null;
  // Per-tick direction — drives the green/red row flash so a fast-moving
  // option visibly throbs (up = green wash, down = red wash). Held for
  // 350ms then cleared; back-to-back ticks re-arm the timer so each
  // price change gets its own pulse.
  const flash = usePriceFlash(liveLtp);
  const changePct = leg?.change_pct ?? null;
  const sideColor = side === "CE" ? colors.buy : colors.sell;
  const empty = !leg || liveLtp == null;
  const align = side === "CE" ? "flex-start" : "flex-end";

  const onPress = () => {
    if (!leg?.token) return;
    // We want back-from-the-new-option-chart to land on the screen that
    // ORIGINALLY opened the chain — typically Market/Home — not the
    // underlying's chart that the chain was pushed on top of.
    //
    // Previously this used `router.replace`, which only swaps the
    // option-chain for the new chart. If the chain was pushed on top of
    // a parent chart (Chart(NIFTY) → OptionChain → strike-tap), the
    // parent chart stayed in the stack and back from the option's chart
    // bounced through it ("back doesn't work, chart re-opens" — that
    // bug). `dismissAll` clears every push above the tab root, then we
    // push the new chart cleanly so the stack is exactly
    // [tab-root, Chart(option)] and back is a single tap to Market.
    try {
      router.dismissAll();
    } catch {
      // dismissAll throws on some versions when there's nothing to
      // dismiss — ignore and fall through to push.
    }
    router.push({ pathname: "/(tabs)/trade", params: { token: leg.token } });
  };

  if (empty) {
    return (
      <Pressable disabled style={{ flex: 1 }}>
        <View style={{ alignItems: align, paddingHorizontal: 4 }}>
          <Text mono tone="dim" style={{ fontSize: 13, fontWeight: "700" }}>
            —
          </Text>
        </View>
      </Pressable>
    );
  }

  const ltpValue = liveLtp as number;
  const up = changePct != null && changePct >= 0;

  // Tick-flash wash applied to the cell background. Green when the LTP
  // just ticked up, red when it just ticked down. Subtle 15% alpha so
  // the row is glanceable but doesn't compete with the strike column.
  const flashBg =
    flash === "up"
      ? "rgba(34,197,94,0.22)"
      : flash === "down"
      ? "rgba(239,68,68,0.22)"
      : "transparent";

  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View
        style={{
          alignItems: align,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 6,
          backgroundColor: flashBg,
        }}
      >
        <Text
          mono
          style={{
            color: sideColor,
            fontSize: 15,
            fontWeight: "800",
          }}
          numberOfLines={1}
        >
          {formatINR(ltpValue)}
        </Text>
        {showChange && changePct != null ? (
          <View
            style={{
              marginTop: 2,
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: 4,
              backgroundColor: up ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            }}
          >
            <Text
              mono
              size="xs"
              style={{
                color: up ? colors.buy : colors.sell,
                fontSize: 10,
                fontWeight: "700",
              }}
            >
              {formatSigned(changePct)}%
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

function SkeletonList() {
  return (
    <View style={{ paddingTop: 8 }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            height: ROW_HEIGHT,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            opacity: 0.6 - i * 0.05,
          }}
        >
          <View style={{ flex: 1, alignItems: "flex-start", gap: 6 }}>
            <View
              style={{
                width: 60,
                height: 14,
                borderRadius: 4,
                backgroundColor: colors.bgElevated,
              }}
            />
            <View
              style={{
                width: 32,
                height: 10,
                borderRadius: 4,
                backgroundColor: colors.bgElevated,
              }}
            />
          </View>
          <View
            style={{
              width: 64,
              height: 22,
              borderRadius: radii.sm,
              backgroundColor: colors.bgElevated,
            }}
          />
          <View style={{ flex: 1, alignItems: "flex-end", gap: 6 }}>
            <View
              style={{
                width: 60,
                height: 14,
                borderRadius: 4,
                backgroundColor: colors.bgElevated,
              }}
            />
            <View
              style={{
                width: 32,
                height: 10,
                borderRadius: 4,
                backgroundColor: colors.bgElevated,
              }}
            />
          </View>
        </View>
      ))}
      <View style={{ alignItems: "center", marginTop: 16 }}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    </View>
  );
}
