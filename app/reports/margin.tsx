import { Card } from "@shared/ui/Card";
import { Text } from "@shared/ui/Text";
import { formatINR } from "@shared/utils/format";
import { ReportPage, ReportRow } from "@features/reports/components/ReportPage";
import { useMarginReport } from "@features/reports/hooks/useReports";

export default function MarginReport() {
  const q = useMarginReport();
  const d = q.data;
  const rows = d?.rows ?? [];

  return (
    <ReportPage
      title="Margin"
      isLoading={q.isLoading}
      isError={q.isError}
      isRefetching={q.isRefetching}
      errorMessage={(q.error as Error | undefined)?.message}
      onRefresh={() => q.refetch()}
      empty={!d}
      downloadKind="margin"
    >
      {d ? (
        <>
          <Card>
            <ReportRow label="Used" value={formatINR(d.total_used)} tone="sell" />
            <ReportRow label="Available" value={formatINR(d.total_available)} tone="buy" />
            <ReportRow label="Total" value={formatINR(d.total)} />
          </Card>
          {rows.length > 0 ? (
            <>
              <Text tone="muted" size="xs" style={{ marginTop: 6, marginLeft: 4 }}>
                By segment
              </Text>
              {rows.map((r, i) => (
                <Card key={`${r.segment}-${i}`}>
                  <ReportRow label={`${r.segment} · Used`} value={formatINR(r.used)} />
                  <ReportRow
                    label="Available"
                    value={formatINR(r.available)}
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
