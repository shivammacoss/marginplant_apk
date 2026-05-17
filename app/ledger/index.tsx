import { RefreshControl, ScrollView, View } from "react-native";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Card } from "@shared/ui/Card";
import { Row } from "@shared/ui/Row";
import { Text } from "@shared/ui/Text";
import { Loader } from "@shared/ui/Loader";
import { colors, spacing } from "@shared/theme";
import { formatINR } from "@shared/utils/format";
import { fmtDate } from "@shared/utils/time";
import { useLedger } from "@features/wallet/hooks/useLedger";

export default function LedgerScreen() {
  const q = useLedger({ limit: 100 });
  const d = q.data;
  const rows = d?.rows ?? [];

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Header title="Ledger" back />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: 10, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={q.isRefetching}
            onRefresh={() => q.refetch()}
          />
        }
      >
        {q.isLoading ? (
          <Loader label="Loading ledger…" />
        ) : q.isError ? (
          <Card>
            <Text tone="sell">
              {(q.error as Error | undefined)?.message ?? "Couldn't load ledger"}
            </Text>
          </Card>
        ) : !d ? null : (
          <>
            <Card>
              <Row
                title="Opening balance"
                rightLabel={formatINR(d.opening_balance)}
                chevron={false}
                divider
              />
              <Row
                title="Credits"
                rightLabel={formatINR(d.total_credits)}
                chevron={false}
                divider
              />
              <Row
                title="Debits"
                rightLabel={formatINR(d.total_debits)}
                chevron={false}
                divider
              />
              <Row
                title="Closing balance"
                rightLabel={formatINR(d.closing_balance)}
                chevron={false}
              />
            </Card>

            {rows.length === 0 ? (
              <View style={{ paddingVertical: 32, alignItems: "center" }}>
                <Text tone="muted">No ledger entries</Text>
              </View>
            ) : (
              rows.map((r) => {
                const credit = Number(r.credit) > 0;
                return (
                  <Card key={r.id}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "500" }} numberOfLines={2}>
                          {r.narration}
                        </Text>
                        <Text tone="muted" size="xs" style={{ marginTop: 2 }}>
                          {fmtDate(r.date)}
                          {r.ref ? ` · ${r.ref}` : ""}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          mono
                          style={{
                            fontWeight: "700",
                            color: credit ? colors.buy : colors.sell,
                          }}
                        >
                          {credit ? "+" : "-"}
                          {formatINR(credit ? r.credit : r.debit)}
                        </Text>
                        <Text tone="dim" size="xs" style={{ marginTop: 2 }}>
                          Bal {formatINR(r.balance)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
