export type KycStatus = "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface KycSubmission {
  id_proof_type: string;
  id_proof_number: string;
  id_proof_url: string;
  address_proof_type: string;
  address_proof_url: string;
  address_text: string;
  selfie_url?: string;
  pan?: string;
}

export interface KycStatusResponse {
  status: KycStatus;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
}

export interface KycUploadResponse {
  url: string;
}
