import { View } from "react-native";
import { Card } from "@shared/ui/Card";
import { Text } from "@shared/ui/Text";
import { colors } from "@shared/theme";
import { formatINR, formatNumber } from "@shared/utils/format";
import { fmtDate, fmtTime } from "@shared/utils/time";
import { ReportPage } from "@features/reports/components/ReportPage";
import { useTradebook } from "@features/reports/hooks/useReports";

export default function Tradebook() {
  const q = useTradebook({ limit: 100 });
  const rows = q.data ?? [];

  return (
    <ReportPage
      title="Tradebook"
      isLoading={q.isLoading}
      isError={q.isError}
      isRefetching={q.isRefetching}
      errorMessage={(q.error as Error | undefined)?.message}
      onRefresh={() => q.refetch()}
      empty={rows.length === 0}
      emptyHint="No trades yet"
      downloadKind="tradebook"
      downloadParams={{ limit: 500 }}
    >
      {rows.map((t) => {
        const buy = t.action === "BUY";
        return (
          <Card key={t.id}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 3,
                  alignSelf: "stretch",
                  borderRadius: 2,
                  backgroundColor: buy ? colors.buy : colors.sell,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600" }} numberOfLines={1}>
                  {t.symbol}
                </Text>
                <Text tone="muted" size="xs" style={{ marginTop: 2 }}>
                  {fmtDate(t.executed_at)} · {fmtTime(t.executed_at)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{
                    color: buy ? colors.buy : colors.sell,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {t.action} {t.quantity}
                </Text>
                <Text mono style={{ marginTop: 2, fontSize: 13 }}>
                  @ {formatNumber(Number(t.price), 2)}
                </Text>
                {t.pnl != null ? (
                  <Text
                    size="xs"
                    style={{
                      color: Number(t.pnl) >= 0 ? colors.buy : colors.sell,
                      marginTop: 2,
                    }}
                  >
                    {formatINR(t.pnl)}
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>
        );
      })}
    </ReportPage>
  );
}
