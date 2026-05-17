import { api } from "@core/api/client";
import { unwrap } from "@core/api/errors";

export interface DateRange {
  from?: string;
  to?: string;
}

export interface PnlRow {
  symbol: string;
  net_pnl: number | string;
  realized_pnl?: number | string;
  unrealized_pnl?: number | string;
  brokerage?: number | string;
  taxes?: number | string;
  trades?: number;
}

export interface PnlReport {
  rows: PnlRow[];
  total_realized: number | string;
  total_unrealized: number | string;
  total_brokerage: number | string;
  total_taxes: number | string;
  total_net: number | string;
  from?: string;
  to?: string;
}

export interface TradebookRow {
  id: string;
  order_id?: string;
  symbol: string;
  action: "BUY" | "SELL";
  product_type?: string;
  segment?: string;
  exchange?: string;
  lots?: number;
  quantity: number;
  price: number | string;
  trade_value?: number | string;
  brokerage?: number | string;
  pnl?: number | string;
  executed_at: string;
}

export interface BrokerageRow {
  segment: string;
  symbol?: string;
  brokerage: number | string;
  taxes: number | string;
  total: number | string;
  trades: number;
}

export interface BrokerageReport {
  rows: BrokerageRow[];
  total_brokerage: number | string;
  total_taxes: number | string;
  total: number | string;
}

export interface MarginRow {
  segment: string;
  used: number | string;
  available: number | string;
  total: number | string;
}

export interface MarginReport {
  rows: MarginRow[];
  total_used: number | string;
  total_available: number | string;
  total: number | string;
}

export interface TaxRow {
  category: "INTRADAY" | "STCG" | "LTCG" | "FNO" | string;
  turnover: number | string;
  realized: number | string;
  taxable: number | string;
  stt?: number | string;
  trades: number;
}

export interface TaxReport {
  rows: TaxRow[];
  total_turnover: number | string;
  total_realized: number | string;
  total_taxable: number | string;
  total_stt: number | string;
  fy?: string;
}

export const ReportsAPI = {
  pnl: (range: DateRange = {}) =>
    unwrap<PnlReport>(api.get("/user/reports/pnl", { params: range })),
  tradebook: (range: DateRange & { limit?: number } = {}) =>
    unwrap<TradebookRow[]>(api.get("/user/reports/tradebook", { params: range })),
  brokerage: (range: DateRange = {}) =>
    unwrap<BrokerageReport>(api.get("/user/reports/brokerage", { params: range })),
  margin: () => unwrap<MarginReport>(api.get("/user/reports/margin")),
  tax: (range: DateRange = {}) =>
    unwrap<TaxReport>(api.get("/user/reports/tax", { params: range })),
};
