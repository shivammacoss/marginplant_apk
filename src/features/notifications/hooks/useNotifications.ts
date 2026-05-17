import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotificationsAPI, type NotifQuery } from "@features/notifications/api/notifications.api";

const KEYS = {
  list: (q: NotifQuery) => ["notifications", q] as const,
  unread: () => ["notifications", "unread-count"] as const,
};

export function useNotifications(q: NotifQuery = {}) {
  return useQuery({
    queryKey: KEYS.list(q),
    queryFn: () => NotificationsAPI.list(q),
    staleTime: 10_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: KEYS.unread(),
    queryFn: () => NotificationsAPI.unreadCount(),
    staleTime: 5_000,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => NotificationsAPI.markRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => NotificationsAPI.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
