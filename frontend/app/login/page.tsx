"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { BookOpen, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../lib/api";
import { dashboardPath } from "../../lib/auth";
import { useAuth } from "../../providers/AuthProvider";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your school login ID"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  useEffect(() => {
    if (redirecting) return;
    if (!loading && user) {
      window.location.replace(user.mustChangePassword ? "/change-password" : dashboardPath(user.role));
    }
  }, [loading, redirecting, user]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    try {
      const loggedInUser = await login(values);
      setRedirecting(true);
      window.location.assign(loggedInUser.mustChangePassword ? "/change-password" : dashboardPath(loggedInUser.role));
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Unable to sign in. Please try again.");
    }
  });

  if (loading || user || redirecting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b1220] px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d9e2ef] border-t-[#17365d]" aria-label="Loading" />
      </main>
    );
  }

  return (
    <main className="login-page flex min-h-screen items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#17365d_0%,_#0b1220_62%)] px-4 py-8 sm:px-6">
      <section className="login-card grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-[0_28px_80px_-32px_rgba(23,54,93,0.5)] md:min-h-[560px] md:grid-cols-[1.08fr_0.92fr]">
        <div className="relative flex min-h-[300px] flex-col overflow-hidden bg-[#102747] px-7 py-7 text-white sm:px-10 md:min-h-[560px] md:px-12 md:py-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full border-[42px] border-[#285487]/35" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-32 size-96 rounded-full border-[48px] border-[#f3c64e]/10" />
          <div className="relative flex items-center gap-3">
            <Image src="/MNHS%20logo.png" alt="Marigondon National High School seal" width={50} height={50} priority className="size-12 object-contain" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#f3c64e]">Marigondon National</p>
              <p className="text-sm font-bold text-white">High School</p>
            </div>
          </div>

          <div className="relative flex flex-1 items-center justify-center py-4 md:py-8">
            <div aria-hidden="true" className="absolute size-56 rounded-full bg-white/[0.04] sm:size-64" />
            <div aria-hidden="true" className="absolute size-64 rounded-full border border-[#f3c64e]/20 sm:size-72" />
            <div className="relative flex size-44 items-center justify-center rounded-[2rem] border border-white bg-[#fffdf5] shadow-[0_20px_45px_-24px_rgba(23,54,93,0.45)] sm:size-52">
              <Image src="/MNHS%20logo.png" alt="" width={180} height={180} className="size-[82%] object-contain" />
            </div>
            <div className="absolute bottom-5 left-[8%] flex items-center gap-2 rounded-xl border border-white/10 bg-[#17365d] px-3 py-2 text-xs font-semibold text-slate-100 shadow-sm sm:bottom-8">
              <BookOpen size={16} className="text-[#f3c64e]" aria-hidden="true" />
              Learning community
            </div>
            <div className="absolute right-[7%] top-8 flex size-11 items-center justify-center rounded-xl bg-[#f3c64e] text-[#17365d] shadow-md sm:right-[10%] sm:top-12 sm:size-12">
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <div aria-hidden="true" className="absolute bottom-2 left-1/2 h-1 w-[72%] -translate-x-1/2 rounded-full bg-[#f3c64e]/35" />
          </div>
          <p className="relative hidden text-center text-xs font-medium tracking-wide text-slate-300 md:block">
            A place to learn, grow, and achieve.
          </p>
        </div>

        <div className="login-form-panel flex items-center bg-white px-7 py-9 text-slate-950 sm:px-12 md:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-7 text-center md:text-left">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#285487]">School portal</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#17365d] sm:text-[1.75rem]">
                Welcome back
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Sign in to your school account to continue.</p>
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="identifier" className="mb-2 block text-sm font-semibold text-slate-800">
                  LRN / ID Number
                </label>
                <div className="relative">
                  <UserRound size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    {...register("identifier")}
                    aria-invalid={Boolean(errors.identifier)}
                    aria-describedby={errors.identifier ? "identifier-error" : "identifier-help"}
                    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#285487] focus:ring-4 focus:ring-[#285487]/10 aria-[invalid=true]:border-rose-500"
                    placeholder="Enter your LRN or ID Number"
                  />
                </div>
                {errors.identifier ? (
                  <p id="identifier-error" className="mt-1.5 text-sm text-rose-700">
                    {errors.identifier.message}
                  </p>
                ) : <p id="identifier-help" className="mt-1.5 text-xs text-slate-600">Enter your LRN or ID number.</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-800">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    {...register("password")}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-12 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#285487] focus:ring-4 focus:ring-[#285487]/10 aria-[invalid=true]:border-rose-500"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 hover:text-[#17365d] focus-visible:outline-2 focus-visible:outline-[#285487]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="mt-1.5 text-sm text-rose-700">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {serverError && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {serverError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || redirecting}
                className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#17365d] px-4 py-3 text-sm font-bold text-white shadow-md shadow-[#17365d]/15 transition hover:bg-[#102747] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285487] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Signing in…
                  </>
                ) : (
                  "Sign in to your account"
                )}
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Link href="/forgot-password" className="text-sm font-semibold text-[#285487] underline-offset-4 hover:text-[#17365d] hover:underline">
                Forgot your password?
              </Link>
              <span className="h-1.5 w-1.5 rounded-full bg-[#d6a829]" aria-hidden="true" />
            </div>
            <div className="mt-7 border-t border-slate-200 pt-5">
              <p className="flex items-center gap-2 text-xs leading-5 text-slate-600">
                <ShieldCheck size={15} className="shrink-0 text-[#285487]" aria-hidden="true" />
                Your account is protected by secure school sign-in.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
