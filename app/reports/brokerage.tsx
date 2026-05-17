import { Card } from "@shared/ui/Card";
import { Text } from "@shared/ui/Text";
import { formatINR } from "@shared/utils/format";
import { ReportPage, ReportRow } from "@features/reports/components/ReportPage";
import { useBrokerageReport } from "@features/reports/hooks/useReports";

export default function Brokerage() {
  const q = useBrokerageReport();
  const d = q.data;
  const rows = d?.rows ?? [];

  return (
    <ReportPage
      title="Brokerage & charges"
      isLoading={q.isLoading}
      isError={q.isError}
      isRefetching={q.isRefetching}
      errorMessage={(q.error as Error | undefined)?.message}
      onRefresh={() => q.refetch()}
      empty={!d}
      downloadKind="brokerage"
    >
      {d ? (
        <>
          <Card>
            <ReportRow label="Brokerage" value={formatINR(d.total_brokerage)} />
            <ReportRow label="Taxes" value={formatINR(d.total_taxes)} />
            <ReportRow label="Total" value={formatINR(d.total)} />
          </Card>
          {rows.length > 0 ? (
            <>
              <Text tone="muted" size="xs" style={{ marginTop: 6, marginLeft: 4 }}>
                By segment
              </Text>
              {rows.map((r, i) => (
                <Card key={`${r.segment}-${i}`}>
                  <ReportRow label={r.segment} value={formatINR(r.total)} />
                  <ReportRow
                    label="Trades"
                    value={String(r.trades)}
                    tone="muted"
                  />
                </Card>
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </ReportPage>
  );
}
