import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(128)
    .transform((value) => value.includes("@") ? value.toLowerCase() : value.toUpperCase()),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/, "New password must contain at least one letter")
    .regex(/[0-9]/, "New password must contain at least one number"),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
});

export const passwordResetCompleteSchema = z.object({
  token: z.string().min(32).max(128),
  newPassword: z.string().min(8).max(128)
    .regex(/[A-Za-z]/, "New password must contain at least one letter")
    .regex(/[0-9]/, "New password must contain at least one number"),
});

export type LoginBody = z.infer<typeof loginSchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
export type PasswordResetRequestBody = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetCompleteBody = z.infer<typeof passwordResetCompleteSchema>;
