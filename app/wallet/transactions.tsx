import { RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { colors } from "@shared/theme";
import { formatINR } from "@shared/utils/format";
import { useWalletTransactions } from "@features/wallet/hooks/useWallet";
import type { TxnStatus, TxnType, WalletTransaction } from "@features/wallet/types/wallet.types";

const TYPE_LABEL: Record<TxnType, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  TRADE: "Trade",
  BROKERAGE: "Brokerage",
  CHARGES: "Charges",
  PNL: "P&L",
  ADJUSTMENT: "Adjustment",
  BONUS: "Bonus",
  PENALTY: "Penalty",
  PROMO: "Promo",
  INTER_USER: "Transfer",
  REVERSAL: "Reversal",
};

const STATUS_COLOR: Record<TxnStatus, string> = {
  PENDING: colors.warn,
  COMPLETED: colors.buy,
  FAILED: colors.sell,
  REVERSED: colors.textDim,
};

function TxnRow({ txn }: { txn: WalletTransaction }) {
  const amount = Number(txn.amount);
  const isCredit = amount >= 0;
  const sign = isCredit ? "+" : "-";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.bgSurface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={isCredit ? "arrow-down" : "arrow-up"}
          size={16}
          color={isCredit ? colors.buy : colors.sell}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "500" }}>{TYPE_LABEL[txn.transaction_type] ?? txn.transaction_type}</Text>
        <Text tone="muted" size="xs" style={{ marginTop: 2 }} numberOfLines={1}>
          {txn.narration}
        </Text>
        <Text tone="dim" size="xs" style={{ marginTop: 2 }}>
          {new Date(txn.created_at).toLocaleString()}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontWeight: "600", color: isCredit ? colors.buy : colors.sell }}>
          {sign}
          {formatINR(Math.abs(amount))}
        </Text>
        <Text size="xs" style={{ color: STATUS_COLOR[txn.status] ?? colors.textDim, marginTop: 2 }}>
          {txn.status}
        </Text>
      </View>
    </View>
  );
}

export default function TransactionsScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useWalletTransactions(100, 0);
  const items = data ?? [];

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16 }}>
        <Header title="Transactions" back />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={isRefetching}
            onRefresh={() => refetch()}
          />
        }
      >
        {isLoading ? (
          <Text tone="muted">Loading transactions…</Text>
        ) : isError ? (
          <Text tone="sell">{(error as Error)?.message || "Couldn't load transactions"}</Text>
        ) : items.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48, gap: 8 }}>
            <Ionicons name="receipt-outline" size={48} color={colors.textDim} />
            <Text tone="muted">No transactions yet</Text>
          </View>
        ) : (
          items.map((t) => <TxnRow key={t.id} txn={t} />)
        )}
      </ScrollView>
    </Screen>
  );
}
