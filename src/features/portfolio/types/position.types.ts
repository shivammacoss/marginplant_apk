export type PositionStatus = "OPEN" | "CLOSED";
export type CurrencyQuote = "INR" | "USD";

// Server-side tag for WHY a position closed. Used on the Closed tab to
// show "Closed by SL" / "Closed by TP" / "Stop-out" etc. Mirrors the
// strings written by marginplant_ind/backend/app/services/risk_enforcer.py
// and api/v1/user/positions.py (the squareoff endpoints).
export type CloseReason = "SL_HIT" | "TP_HIT" | "STOP_OUT" | "USER" | "AUTO";

export interface Position {
  id: string;
  user_id: string;
  symbol: string;
  exchange?: string;
  instrument_token: string;
  segment_type?: string;
  product_type: string;
  quantity: number;
  // Peak |quantity| this position ever held before close — stable across
  // the full life cycle. Closed rows have `quantity === 0`, so to display
  // size/lots on the Closed-tab card we read `opening_quantity` instead.
  opening_quantity?: number;
  lot_size?: number;
  lots?: number;
  avg_price: string;
  ltp: string;
  realized_pnl: string;
  unrealized_pnl: string;
  margin_used: string;
  charges?: string;
  currency_quote?: CurrencyQuote;
  open_usd_inr_rate?: string | null;
  current_usd_inr_rate?: string | null;
  stop_loss?: string | null;
  target?: string | null;
  status: PositionStatus;
  opened_at?: string | null;
  closed_at?: string | null;
  // Only set on CLOSED rows. Null on OPEN.
  close_reason?: CloseReason | string | null;
  // Direction the user originally opened the position with — stays "BUY"
  // / "SELL" even after `quantity` is reduced to 0 by the closing leg.
  // The Closed tab must read THIS for the row's side, not `quantity` (a
  // fully-closed position has quantity 0 which would otherwise default
  // to SELL). Backend stamps this on insert / reopen / flip; older rows
  // back-filled by scripts/backfill_position_opened_side.py.
  opened_side?: "BUY" | "SELL" | null;
}

export interface Holding {
  id: string;
  user_id: string;
  symbol: string;
  exchange?: string;
  instrument_token: string;
  quantity: number;
  avg_price: string;
  ltp: string;
  invested_value: string;
  current_value: string;
  pnl: string;
  pnl_percentage?: number;
}

// Per-fill view returned by `/user/positions/active-trades`. Same shape as the
// web admin/user uses — one row per open BUY (for longs) or open SELL (for
// shorts) trade.
export interface ActiveTrade {
  id: string;
  trade_number?: string;
  executed_at: string | null;
  position_id: string;
  symbol: string;
  exchange?: string;
  segment?: string;
  instrument_token: string;
  currency_quote?: CurrencyQuote;
  action: "BUY" | "SELL";
  side: "BUY" | "SELL";
  product_type: string;
  quantity: number;
  lots: number;
  lot_size: number;
  price: string;
  ltp: string;
  stop_loss?: string | null;
  target?: string | null;
  pnl: string;
  brokerage?: string;
}

export interface PnLSummary {
  today_pnl: number;
  today_realised: number;
  open_unrealised: number;
  week_pnl: number;
  week_realised: number;
  last_week_pnl: number;
  today_start?: string;
  week_start?: string;
  last_week_start?: string;
  last_week_end?: string;
  usd_inr_rate?: number;
}
