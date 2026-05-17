import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  WalletAPI,
  type DepositInput,
  type WithdrawalInput,
} from "@features/wallet/api/wallet.api";
import { ApiError } from "@core/api/errors";
import { useUiStore } from "@shared/store/ui.store";
import { useAuthStore } from "@features/auth/store/auth.store";
import type {
  CompanyBank,
  DepositRequestOut,
  UserBank,
  WalletSummary,
  WalletTransaction,
  WithdrawalRequestOut,
} from "@features/wallet/types/wallet.types";

const SUMMARY_KEY = ["wallet", "summary"] as const;
const TXNS_KEY = (limit: number, skip: number) =>
  ["wallet", "transactions", limit, skip] as const;
const COMPANY_BANKS_KEY = ["wallet", "company-banks"] as const;
const MY_BANKS_KEY = ["wallet", "bank-accounts"] as const;
const DEPOSITS_KEY = ["wallet", "deposits"] as const;
const WITHDRAWALS_KEY = ["wallet", "withdrawals"] as const;

export function useWalletSummary() {
  // CRITICAL: must be gated on auth — TradeSheet is pre-mounted globally
  // and calls this hook, so without the gate it fires /wallet/summary on
  // every unauthenticated screen (login/register), gets 401, and the
  // 401-handler kept replacing the route in a loop.
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return useQuery<WalletSummary>({
    queryKey: SUMMARY_KEY,
    queryFn: () => WalletAPI.summary(),
    enabled: isAuth,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

// Backwards-compatible alias for existing consumers.
export const useWallet = useWalletSummary;

export function useWalletTransactions(limit = 50, skip = 0) {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return useQuery<WalletTransaction[]>({
    queryKey: TXNS_KEY(limit, skip),
    queryFn: () => WalletAPI.transactions(limit, skip),
    enabled: isAuth,
    staleTime: 15_000,
  });
}

export function useCompanyBanks() {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return useQuery<CompanyBank[]>({
    queryKey: COMPANY_BANKS_KEY,
    queryFn: () => WalletAPI.companyBanks(),
    enabled: isAuth,
    staleTime: 5 * 60_000,
  });
}

export function useMyBankAccounts() {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return useQuery<UserBank[]>({
    queryKey: MY_BANKS_KEY,
    queryFn: () => WalletAPI.myBankAccounts(),
    enabled: isAuth,
  });
}

export function useMyDeposits() {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return useQuery<DepositRequestOut[]>({
    queryKey: DEPOSITS_KEY,
    queryFn: () => WalletAPI.myDeposits(),
    enabled: isAuth,
  });
}

export function useMyWithdrawals() {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return useQuery<WithdrawalRequestOut[]>({
    queryKey: WITHDRAWALS_KEY,
    queryFn: () => WalletAPI.myWithdrawals(),
    enabled: isAuth,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: ["wallet"] });
}

// Every mutation below fires its success toast in `onMutate` — the same
// frame as the tap. `onSuccess` only handles cache invalidation. Net
// effect: zero perceived latency on button presses; if the backend
// actually rejects, `onError` overrides with a red toast.

export function useDeposit() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (body: DepositInput) => WalletAPI.createDeposit(body),
    onMutate: () => {
      pushToast({
        kind: "success",
        message: "Deposit submitted",
        ttlMs: 1800,
      });
    },
    onSuccess: () => invalidateAll(qc),
    onError: (e: ApiError) => pushToast({ kind: "error", message: e.message }),
  });
}

export function useWithdraw() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (body: WithdrawalInput) => WalletAPI.createWithdrawal(body),
    onMutate: () => {
      pushToast({
        kind: "success",
        message: "Withdrawal requested",
        ttlMs: 1800,
      });
    },
    onSuccess: () => invalidateAll(qc),
    onError: (e: ApiError) => pushToast({ kind: "error", message: e.message }),
  });
}

export function useUploadScreenshot() {
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (file: { uri: string; name: string; type: string }) =>
      WalletAPI.uploadScreenshot(file),
    onError: (e: ApiError) =>
      pushToast({ kind: "error", message: e.message || "Upload failed" }),
  });
}

export function useAddBankAccount() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (body: Partial<UserBank>) => WalletAPI.addBankAccount(body),
    onMutate: () => {
      pushToast({
        kind: "success",
        message: "Bank account added",
        ttlMs: 1500,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MY_BANKS_KEY });
    },
    onError: (e: ApiError) => pushToast({ kind: "error", message: e.message }),
  });
}
