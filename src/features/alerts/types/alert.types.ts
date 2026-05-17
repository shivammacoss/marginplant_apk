export type AlertType = "LTP_ABOVE" | "LTP_BELOW" | "CHANGE_PCT_ABOVE" | "CHANGE_PCT_BELOW";
export type AlertStatus = "ACTIVE" | "TRIGGERED" | "EXPIRED" | "CANCELLED";

export interface PriceAlert {
  id: string;
  user_id?: string;
  token: string;
  symbol?: string;
  alert_type: AlertType;
  target_price?: string | number | null;
  target_percent?: string | number | null;
  status: AlertStatus;
  message?: string | null;
  created_at: string;
  triggered_at?: string | null;
}

export interface CreateAlertInput {
  token: string;
  alert_type: AlertType;
  target_price?: number;
  target_percent?: number;
  message?: string;
}
