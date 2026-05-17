import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertsAPI } from "@features/alerts/api/alerts.api";
import type { CreateAlertInput } from "@features/alerts/types/alert.types";
import { ApiError } from "@core/api/errors";
import { useUiStore } from "@shared/store/ui.store";

const KEY = ["alerts"] as const;

export function useAlerts() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => AlertsAPI.list(),
    staleTime: 30_000,
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (body: CreateAlertInput) => AlertsAPI.create(body),
    onSuccess: () => {
      pushToast({ kind: "success", message: "Alert created" });
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: ApiError) =>
      pushToast({ kind: "error", message: e.message ?? "Couldn't create alert" }),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (id: string) => AlertsAPI.remove(id),
    onSuccess: () => {
      pushToast({ kind: "info", message: "Alert removed" });
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: ApiError) =>
      pushToast({ kind: "error", message: e.message ?? "Couldn't remove alert" }),
  });
}
