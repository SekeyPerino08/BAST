"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Eye, EyeOff, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ApiError, apiFetch } from "../../lib/api";
import { dashboardPath } from "../../lib/auth";
import { useAuth } from "../../providers/AuthProvider";

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "Use at least 8 characters")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
  confirmPassword: z.string().min(1, "Confirm your new password"),
}).superRefine((values, context) => {
  if (values.newPassword === values.currentPassword) {
    context.addIssue({ code: "custom", path: ["newPassword"], message: "New password must differ from your current password" });
  }
  if (values.newPassword !== values.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
  }
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;
const weakPasswords = new Set(["password1", "12345678a", "qwerty123", "school123", "admin1234"]);

function passwordErrorField(error: unknown): "currentPassword" | "newPassword" | "root.server" {
  if (!(error instanceof ApiError)) return "root.server";
  if (error.message.toLowerCase().includes("current password")) return "currentPassword";
  if (
    error.message.toLowerCase().includes("password") ||
    error.message.toLowerCase().includes("email")
  ) return "newPassword";
  return "root.server";
}

export function ChangePasswordForm({ forced = false }: Readonly<{ forced?: boolean }>) {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const { control, register, handleSubmit, setError, clearErrors, formState: { errors, isSubmitting, touchedFields } } =
    useForm<PasswordFormValues>({ resolver: zodResolver(passwordFormSchema), mode: "onChange" });
  const currentPassword = useWatch({ control, name: "currentPassword" }) ?? "";
  const newPassword = useWatch({ control, name: "newPassword" }) ?? "";
  const confirmPassword = useWatch({ control, name: "confirmPassword" }) ?? "";
  const emailName = user?.email.split("@")[0]?.toLowerCase() ?? "";
  const checks = [
    { label: "At least 8 characters", valid: newPassword.length >= 8 },
    { label: "Contains a letter", valid: /[A-Za-z]/.test(newPassword) },
    { label: "Contains a number", valid: /\d/.test(newPassword) },
    { label: "Differs from current password", valid: Boolean(newPassword) && newPassword !== currentPassword },
    { label: "Does not contain your email name", valid: !emailName || !newPassword.toLowerCase().includes(emailName) },
    { label: "Is not a commonly used password", valid: Boolean(newPassword) && !weakPasswords.has(newPassword.toLowerCase()) },
    { label: "Confirmation matches", valid: Boolean(confirmPassword) && newPassword === confirmPassword },
  ];

  const strengthIndex = checks.filter((check) => check.valid).length;
  const strengthLevel = strengthIndex <= 2 ? "Weak" : strengthIndex <= 4 ? "Fair" : strengthIndex <= 6 ? "Good" : "Strong";
  const strengthSegments = [
    strengthIndex >= 2,
    strengthIndex >= 4,
    strengthIndex >= 6,
    strengthIndex >= 7,
  ];

  const submit = handleSubmit(async ({ currentPassword: current, newPassword: next }) => {
    clearErrors();
    try {
      await apiFetch<void>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      toast.success("Password changed successfully");
      const updated = await refresh();
      if (forced && updated) router.replace(dashboardPath(updated.role));
    } catch (error) {
      const field = passwordErrorField(error);
      setError(field, {
        type: "server",
        message: error instanceof ApiError ? error.message : "Could not change password. Please try again.",
      });
    }
  });

  function passwordInput(name: "currentPassword" | "newPassword" | "confirmPassword", label: string, autoComplete: string) {
    const error = errors[name];
    const isVisible = visible[name] ?? false;
    const registerField = register(name);
    const hasBeenTouched = Boolean(touchedFields[name]);
    return (
      <div>
        <label htmlFor={`password-${name}`} className="mb-1.5 block text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          {label}
        </label>
        <div className="relative">
          <input
            id={`password-${name}`}
            type={isVisible ? "text" : "password"}
            autoComplete={autoComplete}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `password-${name}-error` : undefined}
            {...registerField}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-11 text-[15px] text-slate-900 outline-none transition hover:border-[#1d6a45] focus:border-[#1d6a45] focus:ring-4 focus:ring-[#1d6a45]/10 aria-[invalid=true]:border-rose-500 aria-[invalid=true]:focus:ring-rose-500/10"
          />
          <button
            type="button"
            aria-label={`${isVisible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            onClick={() => setVisible((state) => ({ ...state, [name]: !isVisible }))}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-500 transition hover:text-[#0d412e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45]"
          >
            {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {error?.message && hasBeenTouched && (
          <p id={`password-${name}-error`} role="alert" className="mt-1 text-sm text-rose-700">
            {error.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,440px)_minmax(260px,1fr)]">
      <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
        {forced && (
          <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950">
            For your security, please choose a new password before continuing.
          </div>
        )}

        {passwordInput("currentPassword", "Current password", "current-password")}
        {passwordInput("newPassword", "New password", "new-password")}
        {passwordInput("confirmPassword", "Confirm new password", "new-password")}

        {errors.root?.server && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {errors.root.server.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || checks.some((check) => !check.valid)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d412e] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(13,65,46,0.18)] transition hover:bg-[#135b3b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none motion-reduce:transition-none"
        >
          {isSubmitting && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? "Updating password…" : "Change password"}
        </button>
      </form>

      <aside className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm xl:sticky xl:top-6 xl:h-fit">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf7ef] text-[#0d412e]">
            <ShieldCheck size={16} aria-hidden="true" />
          </span>
          <h3 className="text-base font-semibold text-slate-900">Password requirements</h3>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span className="font-medium">Security level</span>
            <span className="font-semibold text-[#0d412e]">{strengthLevel}</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2" aria-label="Password strength">
            {strengthSegments.map((segment, index) => (
              <span
                key={index}
                className={`h-2.5 rounded-full transition-all duration-200 motion-reduce:transition-none ${
                  segment ? "bg-gradient-to-r from-[#1d6a45] to-[#0d412e]" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>

        <ul aria-label="New password requirements" aria-live="polite" className="mt-5 space-y-2">
          {checks.map((check) => (
            <li
              key={check.label}
              className={`flex items-center gap-3 rounded-lg border px-2.5 py-2 text-[15px] transition-all duration-200 motion-reduce:transition-none ${
                check.valid ? "border-emerald-200 bg-emerald-50/70 text-slate-800" : "border-transparent bg-transparent text-slate-500"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] transition-all duration-200 motion-reduce:transition-none ${
                  check.valid
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 bg-white text-slate-400"
                }`}
                aria-hidden="true"
              >
                {check.valid ? <Check size={12} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span>{check.label}</span>
              <span className="sr-only">{check.valid ? "met" : "not met"}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
