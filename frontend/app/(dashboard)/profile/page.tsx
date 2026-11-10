"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Info,
  KeyRound,
  Mail,
  ShieldCheck,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ErrorState, Modal, StatusBadge } from "../../../components/shared";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { RoleGuard } from "../../../components/RoleGuard";
import { ChangePasswordForm } from "../../../features/profile/ChangePasswordForm";
import { useMyProfile } from "../../../features/profile/hooks";
import { useAuth } from "../../../providers/AuthProvider";

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function ProfileContent() {
  const profile = useMyProfile();
  const { logout, logoutAll } = useAuth();
  const [logoutSelection, setLogoutSelection] = useState<"current" | "all" | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  async function signOutCurrentDevice() {
    setLogoutPending(true);
    try {
      await logout();
      toast.success("Signed out of this device");
    } catch {
      toast.error("Could not log out. Please try again.");
    } finally {
      setLogoutPending(false);
      setLogoutSelection(null);
    }
  }

  async function signOutAll() {
    setLogoutPending(true);
    try {
      await logoutAll();
      toast.success("Signed out of all devices");
    } catch {
      toast.error("Could not sign out of all devices. Please try again.");
    } finally {
      setLogoutPending(false);
      setLogoutSelection(null);
    }
  }

  async function copyEmail() {
    if (!profile.data?.user.email) return;
    try {
      await navigator.clipboard.writeText(profile.data.user.email);
      setCopiedEmail(true);
      toast.success("Email copied");
      window.setTimeout(() => setCopiedEmail(false), 1400);
    } catch {
      toast.error("Could not copy the email");
    }
  }

  function jumpToSecurity() {
    document.getElementById("profile-security")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const initials = profile.data ? [profile.data.user.email?.split("@")?.[0]?.[0] ?? "U", profile.data.user.role?.[0] ?? "A"].join("").toUpperCase() : "U";

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 px-2 pb-8 pt-1 text-[15px] text-slate-700 sm:px-4">
      <header className="overflow-hidden rounded-[22px] border border-[#dfe9f2] bg-[linear-gradient(135deg,#edf8f2_0%,#eef4fb_100%)] p-5 shadow-[0_12px_28px_rgba(13,65,46,0.06)] sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1d6a45]">Your account</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0d412e] sm:text-[2rem]">Profile</h1>
            <p className="mt-1 text-[15px] text-slate-600">Review your account details and security settings.</p>
          </div>

          {profile.data && (
            <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#dfe9f2] bg-white/75 px-3 py-3 shadow-sm md:max-w-[420px] md:justify-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0d412e] text-lg font-bold text-white shadow-sm">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{profile.data.user.email}</p>
                  <StatusBadge label={profile.data.user.role} color="green" />
                </div>
                <p className="mt-1 text-xs text-slate-600">Last login {formatTimestamp(profile.data.user.lastLoginAt)}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {profile.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-64 animate-pulse rounded-[20px] border border-slate-200 bg-slate-200" />
          ))}
        </div>
      ) : profile.isError ? (
        <ErrorState title="Could not load your profile" error={profile.error} retry={() => void profile.refetch()} />
      ) : profile.data ? (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf7ef] text-[#0d412e]">
                  <UserRound size={18} aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold text-slate-900">Account</h2>
              </div>

              <dl className="mt-5 space-y-3">
                <InfoRow
                  icon={<Mail size={16} aria-hidden="true" />}
                  label="Email"
                  value={profile.data.user.email}
                  action={
                    <button
                      type="button"
                      onClick={() => void copyEmail()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#1d6a45] hover:text-[#0d412e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45]"
                    >
                      {copiedEmail ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                      {copiedEmail ? "Copied" : "Copy"}
                    </button>
                  }
                />
                <InfoRow
                  icon={<ShieldCheck size={16} aria-hidden="true" />}
                  label="Role"
                  value={profile.data.user.role}
                  action={<StatusBadge label={profile.data.user.role} color="green" />}
                />
                <InfoRow icon={<CalendarDays size={16} aria-hidden="true" />} label="Member since" value={formatTimestamp(profile.data.user.createdAt)} />
                <InfoRow icon={<Clock3 size={16} aria-hidden="true" />} label="Last login" value={formatTimestamp(profile.data.user.lastLoginAt)} />
                <InfoRow
                  icon={<KeyRound size={16} aria-hidden="true" />}
                  label="Password last changed"
                  value={profile.data.user.passwordChangedAt ? formatTimestamp(profile.data.user.passwordChangedAt) : "Never"}
                  action={
                    !profile.data.user.passwordChangedAt ? (
                      <button
                        type="button"
                        onClick={jumpToSecurity}
                        className="text-sm font-semibold text-[#1d6a45] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45]"
                      >
                        Change now
                      </button>
                    ) : undefined
                  }
                  tone={profile.data.user.passwordChangedAt ? "default" : "warning"}
                />
              </dl>
            </section>

            <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf4ff] text-[#1d6a45]">
                  <CalendarDays size={18} aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold text-slate-900">Personal information</h2>
              </div>

              {profile.data.person ? (
                <div className="mt-5 min-h-[220px] rounded-[16px] border border-slate-200 bg-slate-50/60 p-4">
                  <dl className="space-y-3">
                    {profile.data.person.type === "STUDENT" ? (
                      <>
                        <ProfileField label="Student number" value={profile.data.person.studentNo} />
                        <ProfileField label="Name" value={profile.data.person.fullName} />
                        <ProfileField label="Current section" value={profile.data.person.currentSection ?? "Not enrolled"} />
                      </>
                    ) : (
                      <>
                        <ProfileField label="Employee number" value={profile.data.person.employeeNo} />
                        <ProfileField label="Name" value={profile.data.person.fullName} />
                        <ProfileField label="Department" value={profile.data.person.department ?? "Not set"} />
                        <ProfileField label="Contact number" value={profile.data.person.contactNo ?? "Not set"} />
                      </>
                    )}
                  </dl>
                </div>
              ) : (
                <div className="mt-5 flex min-h-[220px] flex-col items-center justify-center rounded-[16px] border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#edf7ef] text-[#1d6a45]">
                    <UserRound size={22} aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">No personal details linked</h3>
                  <p className="mt-1 max-w-xs text-sm text-slate-600">This administrator account does not have a linked personal profile yet.</p>
                </div>
              )}

              <InfoCallout className="mt-5" text="Read-only. To correct personal details or your email, contact an administrator." />
            </section>
          </div>

          <section id="profile-security" className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf7ef] text-[#0d412e]">
                <KeyRound size={18} aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold text-slate-900">Security</h2>
            </div>
            <div className="mt-5">
              <ChangePasswordForm />
            </div>
          </section>

          <section className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 shadow-[0_10px_24px_rgba(190,24,93,0.06)] sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <ShieldAlert size={19} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-rose-950">Logout Account</h3>
                  <p className="mt-1 text-sm text-rose-700">This ends your current session.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLogoutSelection("current")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
              >
                <ShieldAlert size={16} aria-hidden="true" />
                Logout
              </button>
            </div>
          </section>
        </>
      ) : null}

      {logoutSelection && (
        <Modal
          title={logoutSelection === "all" ? "Sign out of all devices" : "Log out"}
          description={logoutSelection === "all"
            ? "This ends every active session tied to your account. You will need to sign in again on all devices."
            : "This logs you out of this device only. Other active sessions remain signed in."}
          onClose={() => setLogoutSelection(null)}
          size="max-w-md"
        >
          <div className="space-y-3">
              <button
                type="button"
                disabled={logoutPending}
                onClick={() => void signOutCurrentDevice()}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:border-[#1d6a45] hover:bg-[#edf7ef] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>Log out this device</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-600">Current</span>
              </button>

              <button
                type="button"
                disabled={logoutPending}
                onClick={() => void signOutAll()}
                className="flex w-full items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>Sign out of all devices</span>
                <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-rose-700">All</span>
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}

function ProfileField({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="grid gap-1.5 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-[13px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="text-[15px] font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  action,
  tone = "default",
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: string;
  action?: React.ReactNode;
  tone?: "default" | "warning";
}>) {
  const isWarning = tone === "warning";
  return (
    <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isWarning ? "bg-amber-100 text-amber-700" : "bg-[#edf7ef] text-[#0d412e]"}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <dt className="text-[13px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</dt>
          <dd className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[15px] font-medium text-slate-900">
            <span className={isWarning ? "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-800" : "truncate"}>{value}</span>
          </dd>
        </div>
      </div>
      {action && <div className="flex justify-end sm:justify-start">{action}</div>}
    </div>
  );
}

function InfoCallout({ text, className = "" }: Readonly<{ text: string; className?: string }>) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 ${className}`}>
      <Info size={17} className="mt-0.5 shrink-0 text-sky-700" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RoleGuard allowedRoles={["ADMIN", "TEACHER", "STUDENT"]}>
      <DashboardLayout>
        <ProfileContent />
      </DashboardLayout>
    </RoleGuard>
  );
}
