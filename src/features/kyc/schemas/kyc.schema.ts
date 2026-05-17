import { z } from "zod";
import { isValidAadhaar, isValidIFSC, isValidPAN } from "@shared/utils/validators";

export const panSchema = z.object({
  pan: z
    .string()
    .transform((v) => v.toUpperCase().trim())
    .refine(isValidPAN, "Invalid PAN"),
  full_name_as_per_pan: z.string().min(2),
});

export const aadhaarSchema = z.object({
  aadhaar: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .refine(isValidAadhaar, "Invalid Aadhaar"),
  otp: z.string().length(6, "6-digit OTP"),
});

export const bankSchema = z.object({
  account_number: z.string().regex(/^\d{9,18}$/u, "Invalid account number"),
  ifsc: z
    .string()
    .transform((v) => v.toUpperCase().trim())
    .refine(isValidIFSC, "Invalid IFSC"),
  account_holder: z.string().min(2),
});

export type PanValues = z.infer<typeof panSchema>;
export type AadhaarValues = z.infer<typeof aadhaarSchema>;
export type BankValues = z.infer<typeof bankSchema>;
