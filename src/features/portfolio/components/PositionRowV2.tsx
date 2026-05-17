import { memo } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { formatINR, formatNumber } from "@shared/utils/format";

export interface PositionRowData {
  id: string;
  instrument_token?: string;
  symbol: string;
  exchange?: string;
  side: "BUY" | "SELL";
  quantity: number;
  /**
   * Lot count derived from `Math.abs(position.quantity) / lot_size`. Shown
   * alongside the qty pill (e.g. "2L · 130") so the user sees both the
   * exchange-side contract count AND the admin-configured lot count in
   * one glance.
   */
  lots?: number;
  entry_price: number;
  ltp: number;
  pnl: number;
  status: "OPEN" | "CLOSED";
  timestamp?: string | null;
  expiry_label?: string;
  currency_quote?: "INR" | "USD";
  bid_or_ask?: "BID" | "ASK";
  stop_loss?: string | null;
  target?: string | null;
  close_reason?: string | null;
}

interface Props {
  row: PositionRowData;
  /**
   * Called when the user taps the card. The parent screen decides what
   * to do — typically opens the floating trade sheet for OPEN rows or
   * navigates to the chart for CLOSED rows. Replaces the old inline
   * expansion which lived on the row itself (the user reported the
   * expand-in-place feel as crowded; trade sheet pops on top of the
   * row instead).
   */
  onPress?: () => void;
  onClose?: () => void;
  closing?: boolean;
  onEditSlTp?: () => void;
}

// ── Type scale ───────────────────────────────────────────────────────────
// One scale for the whole card so nothing fights:
//   META  10 / 500 / +0.5 letter-spacing — labels (ENTRY, BID, SL, BUY)
//   BODY  12 / 500                       — meta line (exchange · time)
//   PRICE 14 / 700 / mono                — entry/ltp numbers
//   SYM   16 / 700                       — symbol name + PnL headline
const FONT = {
  metaSize: 10,
  metaWeight: "600" as const,
  metaLetter: 0.5,
  bodySize: 11,
  priceSize: 14,
  priceWeight: "700" as const,
  headlineSize: 16,
  headlineWeight: "700" as const,
};

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function PositionRowV2Impl({ row, onPress, onClose, closing, onEditSlTp }: Props) {
  const isBuy = row.side === "BUY";
  const isUsd = row.currency_quote === "USD";
  const isOpen = row.status === "OPEN";

  const pnlPositive = row.pnl > 0;
  const pnlNegative = row.pnl < 0;
  const pnlTone = pnlPositive ? colors.buy : pnlNegative ? colors.sell : colors.text;
  const sideTint = isBuy ? colors.buy : colors.sell;
  const sideBg = isBuy ? colors.buyDim : colors.sellDim;

  const entryStr = formatNumber(row.entry_price, 2);
  const ltpStr = formatNumber(row.ltp, 2);
  const priceDelta = row.ltp - row.entry_price;
  const priceDeltaPct =
    row.entry_price > 0 ? (priceDelta / row.entry_price) * 100 : 0;
  const deltaSign = priceDelta >= 0 ? "+" : "";

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        marginHorizontal: spacing.lg,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
        overflow: "hidden",
      }}
    >
      {/* Left accent bar — instant visual side cue. Slightly thicker so the
          card feels properly anchored on the side. */}
      <View style={{ width: 3, backgroundColor: sideTint }} />

      <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
        {/* ── Row 1 — side badge + symbol + qty  /  PnL ─────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 3,
                borderRadius: 4,
                backgroundColor: sideBg,
              }}
            >
              <Text
                style={{
                  color: sideTint,
                  fontSize: FONT.metaSize,
                  fontWeight: "800",
                  letterSpacing: FONT.metaLetter + 0.2,
                }}
              >
                {row.side}
              </Text>
            </View>
            <Text
              style={{
                fontSize: FONT.headlineSize,
                fontWeight: FONT.headlineWeight,
                flexShrink: 1,
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {row.symbol}
            </Text>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 4,
                backgroundColor: colors.bgSurface,
              }}
            >
              <Text
                mono
                style={{
                  fontSize: FONT.metaSize,
                  fontWeight: "700",
                  color: colors.textMuted,
                }}
              >
                {/* Show "2L · 130" when lots is available, else just qty.
                    Strip trailing zeros so e.g. 1.0 → "1L", 0.5 → "0.5L"
                    for fractional-lot instruments (crypto/forex). */}
                {row.lots != null && row.lots > 0
                  ? `${(+row.lots.toFixed(2)).toString()}L · ${row.quantity}`
                  : `×${row.quantity}`}
              </Text>
            </View>
          </View>
          <Text
            mono
            style={{
              fontSize: FONT.headlineSize,
              fontWeight: "800",
              color: pnlTone,
            }}
            numberOfLines={1}
          >
            {pnlPositive ? "+" : ""}
            {formatINR(row.pnl)}
          </Text>
        </View>

        {/* ── Row 2 — ENTRY → LTP / BID with delta % ───────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.bgSurface,
            borderRadius: radii.md,
            paddingHorizontal: 12,
            paddingVertical: 9,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: FONT.metaSize,
                fontWeight: FONT.metaWeight,
                letterSpacing: FONT.metaLetter,
              }}
            >
              ENTRY
            </Text>
            <Text
              mono
              style={{
                fontSize: FONT.priceSize,
                fontWeight: FONT.priceWeight,
                color: colors.text,
                marginTop: 3,
              }}
            >
              {entryStr}
            </Text>
          </View>
          <Ionicons
            name="arrow-forward"
            size={13}
            color={colors.textDim}
            style={{ marginHorizontal: 10 }}
          />
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: FONT.metaSize,
                fontWeight: FONT.metaWeight,
                letterSpacing: FONT.metaLetter,
              }}
            >
              {row.bid_or_ask ?? "LTP"}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                marginTop: 3,
              }}
            >
              <Text
                mono
                style={{
                  fontSize: FONT.priceSize,
                  fontWeight: FONT.priceWeight,
                  color: pnlTone,
                }}
              >
                {ltpStr}
              </Text>
              {row.entry_price > 0 ? (
                <Text
                  mono
                  style={{
                    color: pnlTone,
                    fontSize: FONT.bodySize,
                    fontWeight: "600",
                    marginLeft: 5,
                  }}
                >
                  {deltaSign}
                  {formatNumber(priceDeltaPct, 2)}%
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Row 3 — meta · actions  OR  meta · close-reason ───────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexShrink: 1,
            }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: FONT.bodySize,
                fontWeight: "500",
              }}
              numberOfLines={1}
            >
              {row.expiry_label ?? row.exchange ?? "—"}
            </Text>
            {row.timestamp ? (
              <>
                <Text
                  style={{
                    color: colors.textDim,
                    fontSize: FONT.bodySize,
                    marginHorizontal: 6,
                  }}
                >
                  ·
                </Text>
                <Text
                  mono
                  style={{
                    color: colors.textMuted,
                    fontSize: FONT.bodySize,
                    fontWeight: "500",
                  }}
                >
                  {fmtTime(row.timestamp)}
                </Text>
              </>
            ) : null}
          </View>

          {isOpen ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {onEditSlTp ? (
                <ActionButton
                  label="SL · TP"
                  icon="flag-outline"
                  tone="primary"
                  onPress={onEditSlTp}
                />
              ) : null}
              {onClose ? (
                <ActionButton
                  label={closing ? "CLOSING" : "CLOSE"}
                  icon="close"
                  tone="sell"
                  onPress={onClose}
                  disabled={closing}
                />
              ) : null}
            </View>
          ) : (
            <ClosedReasonBadge reason={row.close_reason} />
          )}
        </View>

        {/* ── Row 4 (conditional) — SL/TP summary chips ─────────────── */}
        {isOpen && (row.stop_loss || row.target) ? (
          <View style={{ flexDirection: "row", gap: 6 }}>
            {row.stop_loss ? (
              <SlTpChip label="SL" value={Number(row.stop_loss)} tone="sell" />
            ) : null}
            {row.target ? (
              <SlTpChip label="TP" value={Number(row.target)} tone="buy" />
            ) : null}
          </View>
        ) : null}

      </View>
    </Pressable>
  );
}

// Unified action-button — same height, same radius, same border treatment
// regardless of tone. The earlier mix of purple-tinted pills + pink-tinted
// pills looked like the buttons came from two different designs; this
// shape keeps them visually consistent.
function ActionButton({
  label,
  icon,
  tone,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "primary" | "sell" | "buy";
  onPress: () => void;
  disabled?: boolean;
}) {
  const fg =
    tone === "primary" ? colors.primary :
    tone === "sell"    ? colors.sell    :
    colors.buy;
  const bg =
    tone === "primary" ? colors.primaryDim :
    tone === "sell"    ? colors.sellDim    :
    colors.buyDim;
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 26,
          paddingHorizontal: 10,
          borderRadius: 6,
          backgroundColor: bg,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <Ionicons name={icon} size={11} color={fg} style={{ marginRight: 5 }} />
        <Text
          style={{
            color: fg,
            fontSize: 10.5,
            fontWeight: "800",
            letterSpacing: 0.4,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function SlTpChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "buy" | "sell";
}) {
  const fg = tone === "buy" ? colors.buy : colors.sell;
  const bg = tone === "buy" ? colors.buyDim : colors.sellDim;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        backgroundColor: bg,
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: 9.5,
          fontWeight: "800",
          letterSpacing: 0.5,
          marginRight: 5,
        }}
      >
        {label}
      </Text>
      <Text mono style={{ color: fg, fontSize: 11, fontWeight: "700" }}>
        {formatNumber(value, 2)}
      </Text>
    </View>
  );
}

function ClosedReasonBadge({ reason }: { reason?: string | null }) {
  const meta = (() => {
    switch (reason) {
      case "SL_HIT":
        return { label: "SL HIT", fg: colors.sell, bg: colors.sellDim };
      case "TP_HIT":
        return { label: "TP HIT", fg: colors.buy, bg: colors.buyDim };
      case "STOP_OUT":
        return { label: "STOP-OUT", fg: colors.warn, bg: colors.bgSurface };
      case "USER":
        return { label: "USER", fg: colors.textMuted, bg: colors.bgSurface };
      case "AUTO":
        return { label: "AUTO", fg: colors.textMuted, bg: colors.bgSurface };
      default:
        return { label: "CLOSED", fg: colors.textDim, bg: colors.bgSurface };
    }
  })();
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 4,
        backgroundColor: meta.bg,
      }}
    >
      <Text
        style={{
          color: meta.fg,
          fontSize: 9.5,
          fontWeight: "800",
          letterSpacing: 0.6,
        }}
      >
        {meta.label}
      </Text>
    </View>
  );
}

export const PositionRowV2 = memo(PositionRowV2Impl);
