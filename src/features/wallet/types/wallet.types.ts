export interface WalletSummary {
  available_balance: string;
  used_margin: string;
  realized_pnl: string;
  unrealized_pnl: string;
  credit_limit: string;
  total_deposits: string;
  total_withdrawals: string;
  total_brokerage: string;
  total_charges: string;
}

export type TxnType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TRADE"
  | "BROKERAGE"
  | "CHARGES"
  | "PNL"
  | "ADJUSTMENT"
  | "BONUS"
  | "PENALTY"
  | "PROMO"
  | "INTER_USER"
  | "REVERSAL";

export type TxnStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED";

export interface WalletTransaction {
  id: string;
  transaction_type: TxnType;
  amount: string;
  balance_before: string;
  balance_after: string;
  narration: string;
  status: TxnStatus;
  reference_type?: string | null;
  reference_id?: string | null;
  created_at: string;
}

export type DepositStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type PaymentMode = "BANK_TRANSFER" | "UPI" | "NEFT" | "RTGS" | "IMPS";

export interface DepositRequestOut {
  id: string;
  amount: string;
  payment_mode: PaymentMode | string;
  utr_number?: string | null;
  screenshot_url?: string | null;
  status: DepositStatus;
  user_remark?: string | null;
  admin_remark?: string | null;
  created_at: string;
  processed_at?: string | null;
}

export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED";

export interface WithdrawalRequestOut {
  id: string;
  amount: string;
  bank: Record<string, unknown>;
  status: WithdrawalStatus;
  remarks?: string | null;
  utr_number?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  processed_at?: string | null;
}

export interface CompanyBank {
  id: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  ifsc_code: string;
  upi_id?: string | null;
  qr_code_url?: string | null;
  is_default: boolean;
}

export interface UserBank {
  id: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  ifsc_code: string;
  is_default: boolean;
  is_verified: boolean;
  nickname?: string | null;
}
