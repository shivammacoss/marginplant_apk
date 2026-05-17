import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { colors, radii, spacing } from "@shared/theme";
import { formatINR } from "@shared/utils/format";
import { fmtIST } from "@shared/utils/time";
import { useManualRefresh } from "@shared/hooks/useManualRefresh";
import {
  useMyDeposits,
  useMyWithdrawals,
  useWalletSummary,
  useWalletTransactions,
} from "@features/wallet/hooks/useWallet";
import type {
  DepositRequestOut,
  WithdrawalRequestOut,
} from "@features/wallet/types/wallet.types";

export function WalletScreen() {
  const summary = useWalletSummary();
  const txns = useWalletTransactions(20, 0);
  const deposits = useMyDeposits();
  const withdrawals = useMyWithdrawals();

  const pendingDeposits = useMemo(
    () =>
      (deposits.data ?? []).filter((d) => d.status === "PENDING").length,
    [deposits.data],
  );
  const pendingWithdrawals = useMemo(
    () =>
      (withdrawals.data ?? []).filter((w) => w.status === "PENDING").length,
    [withdrawals.data],
  );

  // RefreshControl spinner driven by user pull-down only — never by the
  // background `refetchInterval` polls that fire every few seconds.
  const { refreshing, onRefresh } = useManualRefresh(async () => {
    await Promise.all([
      summary.refetch(),
      txns.refetch(),
      deposits.refetch(),
      withdrawals.refetch(),
    ]);
  });

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Header title="Wallet" back />
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing["4xl"],
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        <HeroCard
          available={summary.data?.available_balance ?? "0"}
          usedMargin={summary.data?.used_margin ?? "0"}
          credit={summary.data?.credit_limit ?? "0"}
          realised={summary.data?.realized_pnl ?? "0"}
          loading={summary.isLoading}
          error={summary.isError ? (summary.error as Error)?.message : undefined}
        />

        <View style={{ flexDirection: "row", gap: 10 }}>
          <ActionButton
            icon="arrow-down"
            label="Add funds"
            onPress={() => router.push("/wallet/deposit")}
            primary
          />
          <ActionButton
            icon="arrow-up"
            label="Withdraw"
            onPress={() => router.push("/wallet/withdraw")}
          />
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <StatTile
            label="Total deposits"
            value={formatINR(summary.data?.total_deposits ?? 0)}
          />
          <StatTile
            label="Total withdrawals"
            value={formatINR(summary.data?.total_withdrawals ?? 0)}
          />
          <StatTile
            label="Pending deposits"
            value={String(pendingDeposits)}
            hint="awaiting approval"
            tone={pendingDeposits > 0 ? "warn" : "default"}
          />
          <StatTile
            label="Pending withdrawals"
            value={String(pendingWithdrawals)}
            hint="awaiting approval"
            tone={pendingWithdrawals > 0 ? "warn" : "default"}
          />
        </View>

        <SectionHeader
          title="Recent transactions"
          rightLabel={
            (txns.data?.length ?? 0) > 0 ? "View all" : undefined
          }
          onRightPress={() => router.push("/wallet/transactions")}
        />
        <TransactionsList items={txns.data ?? []} loading={txns.isLoading} />

        <SectionHeader title="Deposit requests" />
        <RequestList
          rows={deposits.data ?? []}
          kind="deposit"
          loading={deposits.isLoading}
        />

        <SectionHeader title="Withdrawal requests" />
        <RequestList
          rows={withdrawals.data ?? []}
          kind="withdrawal"
          loading={withdrawals.isLoading}
        />
      </ScrollView>
    </Screen>
  );
}

function HeroCard({
  available,
  usedMargin,
  credit,
  realised,
  loading,
  error,
}: {
  available: string;
  usedMargin: string;
  credit: string;
  realised: string;
  loading: boolean;
  error?: string;
}) {
  return (
    <LinearGradient
      colors={[colors.gradientFrom, colors.gradientVia, colors.gradientTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: radii.xl,
        padding: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <View style={{ gap: 6 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons name="wallet-outline" size={12} color="rgba(255,255,255,0.85)" />
          <Text
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 0.8,
            }}
          >
            AVAILABLE BALANCE
          </Text>
        </View>
        <Text
          mono
          style={{
            color: "#fff",
            fontSize: 28,
            fontWeight: "800",
            lineHeight: 36,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {loading ? "—" : formatINR(available)}
        </Text>
        {error ? (
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11 }}>
            {error}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: "row",
          backgroundColor: "rgba(0,0,0,0.18)",
          borderRadius: radii.lg,
          paddingVertical: 14,
          paddingHorizontal: 4,
        }}
      >
        <HeroStat label="Used" value={formatINR(usedMargin)} />
        <View style={{ width: 1, marginVertical: 4, backgroundColor: "rgba(255,255,255,0.18)" }} />
        <HeroStat label="Credit" value={formatINR(credit)} />
        <View style={{ width: 1, marginVertical: 4, backgroundColor: "rgba(255,255,255,0.18)" }} />
        <HeroStat label="Realised P&L" value={formatINR(realised)} />
      </View>
    </LinearGradient>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  // `adjustsFontSizeToFit` + `numberOfLines={1}` lets RN shrink the
  // value down to ~70% of the base when the number is long
  // (e.g. ₹1,23,456.78). Previously the value was clipped mid-digit
  // ("₹6." for a ₹6,234 used margin) because the column was too
  // narrow for the full string at fixed 12 px. Labels are now stable
  // 2-line max so "Realised P&L" doesn't bleed into the next column.
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
        gap: 3,
      }}
    >
      <Text
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 9,
          fontWeight: "700",
          letterSpacing: 0.5,
          textAlign: "center",
        }}
        numberOfLines={2}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        mono
        style={{ color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center" }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: primary ? colors.primary : colors.border,
          backgroundColor: primary ? colors.primary : colors.bgElevated,
        }}
      >
        <Ionicons
          name={icon}
          size={16}
          color={primary ? "#fff" : colors.text}
          style={{ marginRight: 8 }}
        />
        <Text
          style={{
            fontWeight: "600",
            fontSize: 14,
            color: primary ? "#fff" : colors.text,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn";
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: "47%",
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: tone === "warn" ? "rgba(245,158,11,0.4)" : colors.border,
        padding: spacing.md,
        gap: 4,
      }}
    >
      <Text tone="muted" size="xs" style={{ letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </Text>
      <Text
        mono
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: tone === "warn" ? colors.warn : colors.text,
        }}
      >
        {value}
      </Text>
      {hint ? (
        <Text tone="dim" size="xs">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function SectionHeader({
  title,
  rightLabel,
  onRightPress,
}: {
  title: string;
  rightLabel?: string;
  onRightPress?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: spacing.sm,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "700" }}>{title}</Text>
      {rightLabel ? (
        <Pressable onPress={onRightPress} hitSlop={6}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
            {rightLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TransactionsList({
  items,
  loading,
}: {
  items: import("@features/wallet/types/wallet.types").WalletTransaction[];
  loading: boolean;
}) {
  if (loading) return <SkeletonBlock />;
  if (items.length === 0)
    return <EmptyRow message="No transactions yet" icon="receipt-outline" />;
  const top = items.slice(0, 6);
  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
      }}
    >
      {top.map((t, i) => {
        const amt = Number(t.amount);
        const isCredit = amt >= 0;
        return (
          <View
            key={t.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 12,
              borderBottomWidth: i === top.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: isCredit ? "rgba(45,212,191,0.18)" : "rgba(251,113,133,0.18)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={isCredit ? "arrow-down" : "arrow-up"}
                size={14}
                color={isCredit ? colors.buy : colors.sell}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
                {t.narration || t.transaction_type}
              </Text>
              <Text tone="dim" size="xs">
                {fmtIST(t.created_at, "dd MMM · hh:mm a")}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                mono
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: isCredit ? colors.buy : colors.sell,
                }}
              >
                {isCredit ? "+" : ""}
                {formatINR(amt)}
              </Text>
              <Text tone="dim" size="xs">
                {formatINR(t.balance_after)} bal
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

type RequestRow = DepositRequestOut | WithdrawalRequestOut;

function RequestList({
  rows,
  kind,
  loading,
}: {
  rows: RequestRow[];
  kind: "deposit" | "withdrawal";
  loading: boolean;
}) {
  if (loading) return <SkeletonBlock />;
  if (rows.length === 0)
    return (
      <EmptyRow
        message={`No ${kind} requests yet`}
        icon={kind === "deposit" ? "arrow-down-circle-outline" : "arrow-up-circle-outline"}
      />
    );
  const top = rows.slice(0, 4);
  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
      }}
    >
      {top.map((r, i) => {
        const status = r.status as string;
        const tone =
          status === "APPROVED" || status === "COMPLETED"
            ? "ok"
            : status === "REJECTED" || status === "CANCELLED"
            ? "danger"
            : "warn";
        const color =
          tone === "ok" ? colors.buy : tone === "danger" ? colors.sell : colors.warn;
        const iconName: keyof typeof Ionicons.glyphMap =
          tone === "ok"
            ? "checkmark-circle"
            : tone === "danger"
            ? "close-circle"
            : "time-outline";
        return (
          <View
            key={r.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 12,
              borderBottomWidth: i === top.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
            }}
          >
            <Ionicons name={iconName} size={18} color={color} />
            <View style={{ flex: 1 }}>
              <Text mono style={{ fontSize: 13, fontWeight: "700" }}>
                {formatINR(r.amount)}
              </Text>
              <Text tone="dim" size="xs">
                {fmtIST(r.created_at, "dd MMM · hh:mm a")}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: colors.bgSurface,
              }}
            >
              <Text style={{ color, fontSize: 10, fontWeight: "700" }}>
                {status}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function EmptyRow({
  message,
  icon,
}: {
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.lg,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <Ionicons name={icon} size={26} color={colors.textDim} />
      <Text tone="muted" size="sm">
        {message}
      </Text>
    </View>
  );
}

function SkeletonBlock() {
  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        height: 80,
      }}
    />
  );
}
