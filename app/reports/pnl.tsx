import { View } from "react-native";
import { Card } from "@shared/ui/Card";
import { Text } from "@shared/ui/Text";
import { formatINR } from "@shared/utils/format";
import { ReportPage, ReportRow } from "@features/reports/components/ReportPage";
import { usePnlReport } from "@features/reports/hooks/useReports";

export default function PnlReport() {
  const q = usePnlReport();
  // The backend serialises both the apk-facing shape (`total_net`, `rows`,
  // `total_realized` …) AND the legacy/PDF-builder shape (`net_pnl`,
  // `by_symbol`, `total_buy_value` …). Read with a fallback so a slightly-
  // older backend still renders sane numbers instead of all ₹0.00.
  const d = q.data as
    | {
        total_net?: number | string;
        total_realized?: number | string;
        total_unrealized?: number | string;
        total_brokerage?: number | string;
        total_taxes?: number | string;
        rows?: { symbol: string; net_pnl?: number | string; trades?: number }[];
        net_pnl?: number | string;
        total_charges?: number | string;
        by_symbol?: { symbol: string; pnl?: number | string }[];
      }
    | undefined;
  const totalNet = Number(d?.total_net ?? d?.net_pnl ?? 0);
  const totalRealized = Number(d?.total_realized ?? d?.net_pnl ?? 0);
  const totalUnrealized = Number(d?.total_unrealized ?? 0);
  const totalBrokerage = Number(d?.total_brokerage ?? d?.total_charges ?? 0);
  const totalTaxes = Number(d?.total_taxes ?? 0);
  const rows = (d?.rows ??
    d?.by_symbol?.map((r) => ({
      symbol: r.symbol,
      net_pnl: r.pnl,
      trades: undefined,
    })) ??
    []) as { symbol: string; net_pnl?: number | string; trades?: number }[];
  const netTone = totalNet > 0 ? "buy" : totalNet < 0 ? "sell" : "default";

  return (
    <ReportPage
      title="P&L"
      isLoading={q.isLoading}
      isError={q.isError}
      isRefetching={q.isRefetching}
      errorMessage={(q.error as Error | undefined)?.message}
      onRefresh={() => q.refetch()}
      empty={!d}
      downloadKind="pnl"
    >
      {d ? (
        <>
          <Card>
            <ReportRow label="Net P&L" value={formatINR(totalNet)} tone={netTone} />
            <ReportRow label="Realized" value={formatINR(totalRealized)} />
            <ReportRow label="Unrealized" value={formatINR(totalUnrealized)} />
            <ReportRow
              label="Brokerage"
              value={formatINR(totalBrokerage)}
              tone="muted"
            />
            <ReportRow label="Taxes" value={formatINR(totalTaxes)} tone="muted" />
          </Card>

          <Text tone="muted" size="xs" style={{ marginTop: 6, marginLeft: 4 }}>
            By symbol
          </Text>

          {rows.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <Text tone="muted" size="sm">
                No trades in this period
              </Text>
            </View>
          ) : (
            rows.map((r) => (
              <Card key={r.symbol}>
                <ReportRow label={r.symbol} value={formatINR(r.net_pnl ?? 0)} />
                {r.trades != null ? (
                  <ReportRow
                    label="Trades"
                    value={String(r.trades)}
                    tone="muted"
                  />
                ) : null}
              </Card>
            ))
          )}
        </>
      ) : null}
    </ReportPage>
  );
}
