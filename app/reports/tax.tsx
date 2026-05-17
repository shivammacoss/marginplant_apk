import { Card } from "@shared/ui/Card";
import { Text } from "@shared/ui/Text";
import { formatINR } from "@shared/utils/format";
import { ReportPage, ReportRow } from "@features/reports/components/ReportPage";
import { useTaxReport } from "@features/reports/hooks/useReports";

export default function TaxReport() {
  const q = useTaxReport();
  const d = q.data;
  const rows = d?.rows ?? [];

  return (
    <ReportPage
      title="Tax"
      isLoading={q.isLoading}
      isError={q.isError}
      isRefetching={q.isRefetching}
      errorMessage={(q.error as Error | undefined)?.message}
      onRefresh={() => q.refetch()}
      empty={!d}
      downloadKind="tax"
    >
      {d ? (
        <>
          {d.fy ? (
            <Text tone="muted" size="xs" style={{ marginLeft: 4 }}>
              FY {d.fy}
            </Text>
          ) : null}
          <Card>
            <ReportRow label="Turnover" value={formatINR(d.total_turnover)} />
            <ReportRow label="Realized" value={formatINR(d.total_realized)} />
            <ReportRow label="Taxable" value={formatINR(d.total_taxable)} />
            <ReportRow label="STT" value={formatINR(d.total_stt)} tone="muted" />
          </Card>
          {rows.length > 0 ? (
            <>
              <Text tone="muted" size="xs" style={{ marginTop: 6, marginLeft: 4 }}>
                By category
              </Text>
              {rows.map((r, i) => (
                <Card key={`${r.category}-${i}`}>
                  <ReportRow label={r.category} value={formatINR(r.realized)} />
                  <ReportRow
                    label="Taxable"
                    value={formatINR(r.taxable)}
                    tone="muted"
                  />
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
