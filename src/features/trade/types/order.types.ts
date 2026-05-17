export type OrderStatus =
  | "OPEN"
  | "PENDING"
  | "EXECUTED"
  | "PARTIALLY_FILLED"
  | "CANCELLED"
  | "REJECTED";

export type OrderAction = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "SL" | "SL-M";
export type ProductType = "MIS" | "NRML" | "CNC";
export type Validity = "DAY" | "IOC" | "GTC";

export interface Order {
  id: string;
  order_number?: string;
  user_id: string;
  symbol: string;
  exchange?: string;
  segment?: string;
  token?: string;
  instrument_token?: string;
  action: OrderAction;
  order_type: OrderType;
  product_type: ProductType;
  validity?: Validity;
  lots: number;
  quantity: number;
  filled_quantity: number;
  pending_quantity: number;
  price: string;
  trigger_price: string;
  average_price: string;
  status: OrderStatus;
  rejection_reason?: string | null;
  is_amo?: boolean;
  margin_blocked?: string;
  brokerage?: string;
  other_charges?: string;
  bracket_stop_loss?: string | null;
  bracket_target?: string | null;
  created_at: string;
  executed_at?: string | null;
  cancelled_at?: string | null;
  updated_at?: string | null;
}

export interface PlaceOrderInput {
  token: string;
  action: OrderAction;
  order_type: OrderType;
  product_type: ProductType;
  lots: number;
  price?: number | string;
  trigger_price?: number | string;
  validity?: Validity;
  // Bracket legs — backend auto-places opposite-side SL + target after
  // the entry fills. Maps 1:1 to OrderCreate.stop_loss / .target in
  // marginplant_ind/backend/app/schemas/trading.py.
  stop_loss?: number | null;
  target?: number | null;
  // The bid/ask the user saw on the order panel when they clicked. The
  // matching engine uses this to fill MARKET orders at the exact price
  // the user agreed to (eliminates tick-slip on volatile instruments).
  expected_price?: number | null;
}

export interface ModifyOrderInput {
  lots?: number;
  price?: number | string;
  trigger_price?: number | string;
}
