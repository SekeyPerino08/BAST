"use client";

import Link from "next/link";
import { ArrowLeft, GraduationCap, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChangePasswordForm } from "../../features/profile/ChangePasswordForm";
import { dashboardPath } from "../../lib/auth";
import { useAuth } from "../../providers/AuthProvider";

export default function ChangePasswordPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && !user.mustChangePassword && window.location.pathname === "/change-password") {
      router.replace(dashboardPath(user.role));
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f2f7f3] dark:bg-[#0b1220]" aria-label="Loading account">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#dfeee4] border-t-[#1d6a45]" role="status" aria-label="Loading account" />
    </main>;
  }

  return <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#f2f7f3] px-4 py-8 dark:bg-[#0b1220] sm:px-6 sm:py-12">
    <div aria-hidden="true" className="pointer-events-none absolute -left-36 -top-40 h-96 w-96 rounded-full bg-[#dceee3] blur-3xl dark:bg-[#143b2c]" />
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -right-36 h-[30rem] w-[30rem] rounded-full bg-[#e7efe6] blur-3xl dark:bg-[#172a3d]" />
    <section className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_-40px_rgba(13,65,46,0.35)] dark:border-slate-700 sm:rounded-[2rem]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-[#f7fbf8] to-white px-6 py-7 dark:border-slate-700 dark:from-[#111c2f] dark:to-[#111c2f] sm:px-10 sm:py-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1d6a45] text-white shadow-sm">
              {user.mustChangePassword ? <ShieldCheck size={24} aria-hidden="true" /> : <GraduationCap size={24} aria-hidden="true" />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1d6a45] dark:text-[#a7d7b8]">Account security</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Change your password</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Choose a strong password that you haven’t used before to help keep your account safe.
              </p>
            </div>
          </div>
          {user.mustChangePassword ? (
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              <ShieldCheck size={15} aria-hidden="true" />
              Action required
            </span>
          ) : (
            <Link href={dashboardPath(user.role)} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-[#0d412e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1d6a45] dark:hover:text-white">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to dashboard
            </Link>
          )}
        </div>
      </div>
      <div className="p-5 sm:p-8 lg:p-10">
        <ChangePasswordForm forced={user.mustChangePassword} />
        <div className="mt-8 flex flex-col-reverse items-center justify-between gap-3 border-t border-slate-100 pt-5 text-sm dark:border-slate-700 sm:flex-row">
          <p className="text-xs text-slate-500">Signed in as <span className="font-medium text-slate-700 dark:text-slate-300">{user.email}</span></p>
          <button type="button" onClick={() => void logout()} className="inline-flex min-h-10 items-center rounded-lg px-3 font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] dark:hover:bg-slate-800 dark:hover:text-white">
            Sign out
          </button>
        </div>
      </div>
    </section>
  </main>;
}
