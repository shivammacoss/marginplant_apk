export type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED" | "SUSPENDED";
export type UserRole = "CLIENT" | "MASTER" | "DEALER" | "ADMIN" | "SUPER_ADMIN";
export type KycStatus = "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface User {
  id: string;
  user_code?: string;
  email: string;
  mobile: string;
  full_name: string;
  role: UserRole;
  status?: UserStatus;
  is_demo?: boolean;
  two_fa_enabled?: boolean;
  must_change_password?: boolean;
  pan?: string;
  kyc_status?: KycStatus;
}
