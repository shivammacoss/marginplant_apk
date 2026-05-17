import { api } from "@core/api/client";
import { unwrap } from "@core/api/errors";
import type { AppNotification } from "@features/notifications/types/notification.types";

export interface NotifQuery {
  only_unread?: boolean;
  limit?: number;
}

export const NotificationsAPI = {
  list: (q: NotifQuery = {}) =>
    unwrap<AppNotification[]>(api.get("/user/notifications", { params: q })),
  unreadCount: () =>
    unwrap<{ count: number }>(api.get("/user/notifications/unread-count")),
  markRead: (id: string) =>
    unwrap(api.post(`/user/notifications/${encodeURIComponent(id)}/read`)),
  markAllRead: () =>
    unwrap(api.post("/user/notifications/mark-all-read")),
};
