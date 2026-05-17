import { z } from "zod";
import { isValidEmail, isValidMobileIN } from "@shared/utils/validators";

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Email or mobile required")
    .refine(
      (v) => isValidEmail(v) || isValidMobileIN(v),
      "Enter a valid email or 10-digit mobile",
    ),
  password: z.string().min(8, "Min 8 characters"),
  two_fa_code: z.string().optional(),
});

export type LoginValues = z.infer<typeof loginSchema>;

// Password rules MUST mirror the backend's `RegisterRequest._password_strength`
// validator in backend/app/schemas/auth.py — uppercase + lowercase + digit +
// min 8 chars. If they drift, the form passes locally but the backend
// rejects with a 422 that surfaces as a generic "server error" toast to the
// user. Keep these two in lockstep.
const passwordRule = z
  .string()
  .min(8, "Min 8 characters")
  .max(128, "Max 128 characters")
  .refine((v) => /[A-Z]/.test(v), "Add at least one uppercase letter")
  .refine((v) => /[a-z]/.test(v), "Add at least one lowercase letter")
  .refine((v) => /\d/.test(v), "Add at least one digit");

export const registerSchema = z
  .object({
    full_name: z.string().min(2, "Enter your name"),
    email: z.string().refine(isValidEmail, "Invalid email"),
    mobile: z.string().refine(isValidMobileIN, "Invalid mobile"),
    password: passwordRule,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export type RegisterValues = z.infer<typeof registerSchema>;
