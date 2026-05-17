import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { OrdersAPI, type OrdersQuery } from "@features/trade/api/orders.api";
import type { Order } from "@features/trade/types/order.types";
import { ApiError } from "@core/api/errors";
import { useUiStore } from "@shared/store/ui.store";

export const ORDERS_KEY = (q: OrdersQuery = {}) =>
  ["orders", q.status ?? "all", q.limit ?? 100, q.skip ?? 0] as const;

export function useOrders(q: OrdersQuery = {}) {
  return useQuery<Order[]>({
    queryKey: ORDERS_KEY(q),
    queryFn: () => OrdersAPI.list(q),
    staleTime: 4_000,
    refetchInterval: 5_000,
    // Keep showing the existing rows while a refetch is in flight — Orders
    // tab was flashing "Loading…" every 5s before this. WS push via
    // UserEventsProvider keeps the list real-time between polls anyway.
    placeholderData: keepPreviousData,
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (id: string) => OrdersAPI.cancel(id),
    onMutate: () => {
      // INSTANT confirmation — fires on click, not after HTTP roundtrip.
      pushToast({ kind: "success", message: "Order cancelled", ttlMs: 1500 });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: ApiError) =>
      pushToast({ kind: "error", message: e.message }),
  });
}
