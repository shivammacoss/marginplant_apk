import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { Text } from "@shared/ui/Text";
import { colors, radii, spacing } from "@shared/theme";
import { goBack } from "@shared/utils/navigation";
import { formatINR, formatNumber, formatSigned } from "@shared/utils/format";
import {
  useClosedPositions,
  useOpenPositions,
} from "@features/portfolio/hooks/usePositions";
import type { Position } from "@features/portfolio/types/position.types";

// Full-detail view for a single position — opens when the user taps a
// Closed (or Position) card on the Portfolio screen. The Portfolio card
// itself stays a compact summary; this page is the "I want to see every
// number for that trade" view: entry/exit, lots, contracts, charges,
// margin, USD/INR rates, SL/TP, close reason, hold duration. Reads from
// the cached `useOpenPositions` / `useClosedPositions` lists — no extra
// network call needed since the lists are already in memory by the time
// the user can tap a row.

function pickPositionFromLists(
  id: string | undefined,
  open: Position[] | undefined,
  closed: Position[] | undefined,
): Position | null {
  if (!id) return null;
  return (
    (open ?? []).find((p) => p.id === id) ??
    (closed ?? []).find((p) => p.id === id) ??
    null
  );
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function fmtDuration(fromIso?: string | null, toIso?: string | null): string {
  if (!fromIso) return "—";
  const a = new Date(fromIso).getTime();
  const b = toIso ? new Date(toIso).getTime() : Date.now();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "—";
  const sec = Math.max(0, Math.floor((b - a) / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtCloseReason(r?: string | null): string {
  if (!r) return "Not closed";
  switch (r) {
    case "SL_HIT":
      return "Stop-loss hit";
    case "TP_HIT":
      return "Target hit";
    case "STOP_OUT":
      return "Stop-out (risk)";
    case "USER":
      return "Closed by user";
    case "AUTO":
      return "Auto squareoff";
    default:
      return r;
  }
}

export function PositionDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const open = useOpenPositions();
  const closed = useClosedPositions();
  const position = useMemo(
    () => pickPositionFromLists(id, open.data, closed.data),
    [id, open.data, closed.data],
  );

  if (!position) {
    return (
      <Screen padded={false}>
        <DetailHeader title="Position" />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
          <Ionicons name="alert-circle-outline" size={28} color={colors.textMuted} />
          <Text tone="muted" size="sm" style={{ marginTop: 6 }}>
            {open.isLoading || closed.isLoading
              ? "Loading position…"
              : "Position not found"}
          </Text>
        </View>
      </Screen>
    );
  }

  const isClosed = position.status === "CLOSED";
  const side: "BUY" | "SELL" =
    position.opened_side === "BUY" || position.opened_side === "SELL"
      ? position.opened_side
      : position.quantity > 0
      ? "BUY"
      : "SELL";
  const sideTone = side === "BUY" ? colors.buy : colors.sell;

  // For OPEN rows `quantity` is the current signed contract count; for
  // CLOSED rows it's been zeroed and the stable peak-size lives on
  // `opening_quantity`. Read the right field so the Lots / Contracts
  // figures on a closed BTCUSD don't both render as 0.
  const sizeQty = isClosed
    ? Math.abs(Number(position.opening_quantity ?? position.quantity) || 0)
    : Math.abs(Number(position.quantity) || 0);
  const lotSize = Number(position.lot_size ?? 0) || 0;
  // Lots: prefer the backend's computed `lots` field. On closed rows that
  // field is also 0 (it's derived from current `quantity`), so re-derive
  // from `opening_quantity / lot_size` instead.
  const lots = isClosed
    ? lotSize > 0
      ? sizeQty / lotSize
      : null
    : position.lots != null
    ? Number(position.lots)
    : lotSize > 0
    ? sizeQty / lotSize
    : null;

  const entry = Number(position.avg_price) || 0;
  const ltp = Number(position.ltp) || 0;
  const realized = Number(position.realized_pnl) || 0;
  const unrealized = Number(position.unrealized_pnl) || 0;
  const charges = Number(position.charges ?? 0) || 0;

  // Net P&L includes brokerage / commission. The API serializer already
  // nets `realized_pnl` against charges (the user-reported "commission
  // P&L mein add nahi ho rha" fix), but the older builds + a non-restarted
  // backend would still return gross — so we defensively subtract the
  // remaining charge delta here too. This is idempotent: if the API
  // already netted, the row's `charges` field is what was paid, but
  // `realized_pnl - charges` would double-deduct. To make this safe across
  // both old and new backends we instead show a clear breakdown (Gross /
  // Charges / Net) and compute Net = realized_pnl as-is when the API
  // is the new serializer (positive when realized magnitude already
  // < |gross|), else realized − charges.
  //
  // Simplest correct policy: trust the API to be authoritative for
  // `realized_pnl`, and show a Gross row reconstructed as
  // `realized + charges` (since realized is net). This way the breakdown
  // reads:
  //    Gross P&L   = realized + charges
  //    Charges     = -charges
  //    Net P&L     = realized  ←  matches the headline
  // and the math visibly adds up.
  //
  // For OPEN rows we use unrealized as-is; for CLOSED rows we use realized.
  const netPnl = isClosed ? realized : unrealized + realized;
  const grossPnl = isClosed ? realized + charges : netPnl + charges;
  const pnlTone =
    netPnl > 0 ? colors.buy : netPnl < 0 ? colors.sell : colors.textMuted;

  const margin = Number(position.margin_used ?? 0) || 0;
  const isUSD = position.currency_quote === "USD";
  const openRate = Number(position.open_usd_inr_rate ?? 0) || 0;
  const curRate = Number(position.current_usd_inr_rate ?? 0) || 0;
  const sl = position.stop_loss != null ? Number(position.stop_loss) : null;
  const tp = position.target != null ? Number(position.target) : null;

  return (
    <Screen padded={false}>
      <DetailHeader title="Position detail" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing["2xl"],
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Symbol + side + status hero ──────────────────────────── */}
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radii.lg,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pill
              label={side}
              fg={sideTone}
              bg={side === "BUY" ? colors.buyDim : colors.sellDim}
              border={sideTone}
            />
            <Text style={{ fontSize: 18, fontWeight: "800", flex: 1 }} numberOfLines={2}>
              {position.symbol}
            </Text>
            <Pill
              label={isClosed ? "CLOSED" : "OPEN"}
              fg={isClosed ? colors.textMuted : colors.buy}
              bg={isClosed ? colors.bgSurface : colors.buyDim}
              border={isClosed ? colors.border : colors.buy}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 6,
            }}
          >
            {position.exchange ? (
              <Text tone="muted" size="xs" style={{ fontWeight: "600" }}>
                {position.exchange}
              </Text>
            ) : null}
            {position.product_type ? (
              <>
                <Text tone="dim" size="xs">·</Text>
                <Text tone="muted" size="xs" style={{ fontWeight: "600" }}>
                  {position.product_type}
                </Text>
              </>
            ) : null}
            {isUSD ? (
              <>
                <Text tone="dim" size="xs">·</Text>
                <Text tone="muted" size="xs" style={{ fontWeight: "600" }}>
                  USD-quoted
                </Text>
              </>
            ) : null}
          </View>

          {/* P&L headline */}
          <View style={{ marginTop: 14 }}>
            <Text tone="muted" size="xs" style={{ fontWeight: "700", letterSpacing: 0.5 }}>
              {isClosed ? "NET P&L (REALIZED)" : "NET P&L"}
            </Text>
            <Text
              mono
              style={{
                color: pnlTone,
                fontSize: 28,
                fontWeight: "800",
                marginTop: 2,
              }}
            >
              {formatSigned(netPnl)}
            </Text>
          </View>
        </View>

        {/* Prices ────────────────────────────────────────────────── */}
        <Card title="Prices">
          <InfoRow label="Entry price" value={formatNumber(entry, 2)} mono />
          <InfoRow
            label={isClosed ? "Exit / last price" : "Live price (LTP)"}
            value={formatNumber(ltp, 2)}
            mono
          />
          {isUSD ? (
            <>
              <InfoRow
                label="USD ⁄ INR (open)"
                value={openRate > 0 ? formatNumber(openRate, 4) : "—"}
                mono
              />
              <InfoRow
                label={isClosed ? "USD ⁄ INR (close)" : "USD ⁄ INR (current)"}
                value={curRate > 0 ? formatNumber(curRate, 4) : "—"}
                mono
              />
            </>
          ) : null}
        </Card>

        {/* Quantity + lots ──────────────────────────────────────── */}
        {/* "Contracts" row removed per user request — lots + lot size
            already convey the size; contracts was the (qty / 1) repeat
            of lots × lot_size which felt redundant on the card. */}
        <Card title="Quantity">
          <InfoRow
            label="Lots"
            value={
              lots != null && lots > 0
                ? formatNumber(lots, lots % 1 === 0 ? 0 : 4)
                : "—"
            }
            mono
          />
          <InfoRow label="Lot size" value={lotSize > 0 ? String(lotSize) : "—"} mono />
        </Card>

        {/* P&L breakdown — Gross / Charges / Net so the user can SEE
            the brokerage being deducted. The headline NET P&L at the
            top of the page reads the same `netPnl` number, so the
            breakdown's last row visually adds up to the headline. */}
        <Card title="P&amp;L breakdown">
          {isClosed ? (
            <>
              <InfoRow
                label="Gross P&L"
                value={formatSigned(grossPnl)}
                mono
                tone={
                  grossPnl > 0
                    ? colors.buy
                    : grossPnl < 0
                    ? colors.sell
                    : undefined
                }
              />
              <InfoRow
                label="Brokerage / charges"
                value={charges > 0 ? `−${formatINR(charges)}` : "—"}
                mono
                tone={charges > 0 ? colors.sell : undefined}
              />
              <InfoRow
                label="Net P&L"
                value={formatSigned(netPnl)}
                mono
                tone={
                  netPnl > 0
                    ? colors.buy
                    : netPnl < 0
                    ? colors.sell
                    : undefined
                }
              />
            </>
          ) : (
            <>
              <InfoRow
                label="Unrealized P&L"
                value={formatSigned(unrealized)}
                mono
                tone={
                  unrealized > 0
                    ? colors.buy
                    : unrealized < 0
                    ? colors.sell
                    : undefined
                }
              />
              <InfoRow
                label="Realized P&L"
                value={formatSigned(realized)}
                mono
                tone={
                  realized > 0
                    ? colors.buy
                    : realized < 0
                    ? colors.sell
                    : undefined
                }
              />
              <InfoRow
                label="Brokerage / charges"
                value={charges > 0 ? `−${formatINR(charges)}` : "—"}
                mono
                tone={charges > 0 ? colors.sell : undefined}
              />
            </>
          )}
          {/* Margin used: only show when there's something actually
              locked. Closed positions release margin to 0, where this
              row used to render as a stray "—" that the user flagged. */}
          {margin > 0 ? (
            <InfoRow label="Margin used" value={formatINR(margin)} mono />
          ) : null}
        </Card>

        {/* SL / TP ──────────────────────────────────────────────── */}
        {sl != null || tp != null ? (
          <Card title="Risk legs">
            <InfoRow
              label="Stop-loss"
              value={sl != null ? formatNumber(sl, 2) : "—"}
              mono
              tone={sl != null ? colors.sell : undefined}
            />
            <InfoRow
              label="Target"
              value={tp != null ? formatNumber(tp, 2) : "—"}
              mono
              tone={tp != null ? colors.buy : undefined}
            />
          </Card>
        ) : null}

        {/* Timeline ────────────────────────────────────────────── */}
        <Card title="Timeline">
          <InfoRow label="Opened at" value={fmtDateTime(position.opened_at)} />
          {isClosed ? (
            <InfoRow label="Closed at" value={fmtDateTime(position.closed_at)} />
          ) : null}
          <InfoRow
            label="Hold duration"
            value={fmtDuration(position.opened_at, position.closed_at)}
          />
          {isClosed ? (
            <InfoRow
              label="Close reason"
              value={fmtCloseReason(position.close_reason)}
            />
          ) : null}
        </Card>

        {/* Identifiers ─────────────────────────────────────────── */}
        <Card title="Identifiers">
          <InfoRow label="Position ID" value={position.id} mono small />
          {position.instrument_token ? (
            <InfoRow
              label="Instrument token"
              value={position.instrument_token}
              mono
              small
            />
          ) : null}
          {position.segment_type ? (
            <InfoRow label="Segment" value={position.segment_type} />
          ) : null}
        </Card>

        {/* Actions ─────────────────────────────────────────────── */}
        {position.instrument_token ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(tabs)/trade",
                params: { token: position.instrument_token },
              })
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: colors.primaryDim,
              borderColor: colors.primary,
              borderWidth: 1,
              borderRadius: radii.lg,
              paddingVertical: 14,
              marginTop: 4,
            }}
          >
            <Ionicons name="trending-up" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>
              View chart for {position.symbol}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function DetailHeader({ title }: { title: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingVertical: 12,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      <Pressable onPress={() => goBack("/(tabs)/portfolio")} hitSlop={10}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={{ fontSize: 17, fontWeight: "700", flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 4,
      }}
    >
      <Text
        tone="muted"
        size="xs"
        style={{
          fontWeight: "800",
          letterSpacing: 0.6,
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 6,
        }}
      >
        {title.toUpperCase()}
      </Text>
      <View>{children}</View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  mono,
  small,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
  tone?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 12,
      }}
    >
      <Text tone="muted" size="xs" style={{ fontWeight: "600", flexShrink: 0 }}>
        {label}
      </Text>
      <Text
        mono={mono}
        size={small ? "xs" : "sm"}
        style={{
          color: tone ?? colors.text,
          fontWeight: "700",
          textAlign: "right",
          flexShrink: 1,
        }}
        numberOfLines={small ? 1 : undefined}
      >
        {value}
      </Text>
    </View>
  );
}

function Pill({
  label,
  fg,
  bg,
  border,
}: {
  label: string;
  fg: string;
  bg: string;
  border: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text
        size="xs"
        style={{ color: fg, fontWeight: "800", letterSpacing: 0.6, fontSize: 10 }}
      >
        {label}
      </Text>
    </View>
  );
}
