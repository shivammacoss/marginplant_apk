import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KycAPI } from "@features/kyc/api/kyc.api";
import type { KycSubmission } from "@features/kyc/types/kyc.types";
import { ApiError } from "@core/api/errors";
import { useUiStore } from "@shared/store/ui.store";

const KEY = ["kyc"] as const;

export function useKycStatus() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => KycAPI.status(),
    staleTime: 60_000,
  });
}

export function useUploadKycFile() {
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (file: { uri: string; name: string; type: string }) =>
      KycAPI.upload(file),
    onError: (e: ApiError) =>
      pushToast({ kind: "error", message: e.message ?? "Upload failed" }),
  });
}

export function useSubmitKyc() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (body: KycSubmission) => KycAPI.submit(body),
    onSuccess: () => {
      pushToast({ kind: "success", message: "KYC submitted for review" });
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: ApiError) =>
      pushToast({ kind: "error", message: e.message ?? "KYC submission failed" }),
  });
}
