import { api } from "@core/api/client";
import { unwrap } from "@core/api/errors";
import type {
  CompanyBank,
  DepositRequestOut,
  UserBank,
  WalletSummary,
  WalletTransaction,
  WithdrawalRequestOut,
} from "@features/wallet/types/wallet.types";

export interface DepositInput {
  amount: number;
  payment_mode?: string;
  utr_number?: string;
  screenshot_url?: string;
  user_remark?: string;
  bank_account_id?: string;
}

export interface WithdrawalInput {
  amount: number;
  bank: Record<string, unknown>;
  remarks?: string;
}

export const WalletAPI = {
  summary: () => unwrap<WalletSummary>(api.get("/user/wallet/summary")),

  transactions: (limit = 100, skip = 0) =>
    unwrap<WalletTransaction[]>(
      api.get("/user/wallet/transactions", { params: { limit, skip } }),
    ),

  companyBanks: () => unwrap<CompanyBank[]>(api.get("/user/wallet/company-banks")),

  myBankAccounts: () => unwrap<UserBank[]>(api.get("/user/wallet/bank-accounts")),

  addBankAccount: (body: Partial<UserBank>) =>
    unwrap<{ id: string }>(api.post("/user/wallet/bank-accounts", body)),

  createDeposit: (body: DepositInput) =>
    unwrap<{ id: string; status: string }>(api.post("/user/wallet/deposits", body)),

  myDeposits: () => unwrap<DepositRequestOut[]>(api.get("/user/wallet/deposits")),

  createWithdrawal: (body: WithdrawalInput) =>
    unwrap<{ id: string; status: string }>(api.post("/user/wallet/withdrawals", body)),

  myWithdrawals: () => unwrap<WithdrawalRequestOut[]>(api.get("/user/wallet/withdrawals")),

  uploadScreenshot: (file: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append("file", file as unknown as Blob);
    return unwrap<{ url: string; size: number }>(
      api.post("/user/wallet/upload-screenshot", form, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  },
};
