import { api } from "@core/api/client";
import { unwrap } from "@core/api/errors";

export interface LedgerRow {
  id: string;
  date: string;
  narration: string;
  ref?: string | null;
  debit: number | string;
  credit: number | string;
  balance: number | string;
}

export interface LedgerReport {
  rows: LedgerRow[];
  opening_balance: number | string;
  closing_balance: number | string;
  total_credits: number | string;
  total_debits: number | string;
  from?: string;
  to?: string;
}

export interface LedgerQuery {
  from?: string;
  to?: string;
  limit?: number;
}

export const LedgerAPI = {
  fetch: (q: LedgerQuery = {}) =>
    unwrap<LedgerReport>(api.get("/user/ledger", { params: q })),
};
