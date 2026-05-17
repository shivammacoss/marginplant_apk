export type NotificationType =
  | "ORDER"
  | "POSITION"
  | "WALLET"
  | "ALERT"
  | "KYC"
  | "SYSTEM"
  | "MARKETING";

export interface AppNotification {
  id: string;
  title: string;
  body?: string | null;
  type: NotificationType;
  link?: string | null;
  read: boolean;
  created_at: string;
  data?: Record<string, unknown> | null;
}
