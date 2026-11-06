"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Plus,
  RefreshCw,
  Users,
  UserRoundX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EmptyState, ErrorState } from "../../../components/shared";
import { userDisplayName } from "../../../lib/auth";
import { useAuth } from "../../../providers/AuthProvider";
import { AttendanceTrendChart, EnrollmentChart, SectionSizesChart } from "../../../features/dashboard/charts";
import { useAdminDashboard } from "../../../features/dashboard/hooks";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Created a record",
  UPDATE: "Updated a record",
  STATUS_CHANGE: "Changed a status",
  ENROLL: "Enrolled a student",
  TRANSFER: "Transferred a student",
  ATTENDANCE_SAVE: "Saved attendance",
  GRADES_SAVE: "Saved grades",
  GRADE_CHANGE: "Changed a grade",
  TERM_LOCK: "Locked a term",
  TERM_UNLOCK: "Unlocked a term",
  LOGIN: "Signed in",
  LOGOUT: "Signed out",
  REPORT_CARD_VIEW: "Viewed a report card",
};

function relativeTime(value: string): string {
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  href,
  attention = false,
}: Readonly<{
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  href: string;
  attention?: boolean;
}>) {
  return (
    <Link
      href={href}
      className={`group rounded-2xl border bg-white p-5 shadow-[0_3px_14px_rgba(16,39,71,0.045)] transition hover:-translate-y-0.5 hover:border-[#9bb7d5] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285487] dark:bg-slate-900 ${
        attention ? "border-[#ead59a]" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</p>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
          attention ? "bg-[#fff5d8] text-[#8a6710]" : "bg-[#edf3fa] text-[#17365d]"
        }`}>
          <Icon aria-hidden="true" size={19} />
        </span>
      </div>
      <p className={`mt-4 text-3xl font-bold tracking-tight ${
        attention ? "text-[#8a6710]" : "text-[#17365d] dark:text-white"
      }`}>{value}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">{note}</p>
        <ArrowUpRight aria-hidden="true" size={15} className="text-slate-400 transition group-hover:text-[#285487]" />
      </div>
    </Link>
  );
}

function ProgressCard({
  title,
  value,
  note,
  href,
  icon: Icon,
}: Readonly<{ title: string; value: number; note: string; href: string; icon: LucideIcon }>) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <Link href={href} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_3px_14px_rgba(16,39,71,0.045)] transition hover:border-[#9bb7d5] hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#285487] dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#edf3fa] text-[#17365d]"><Icon size={18} aria-hidden="true" /></span>
          <h2 className="text-sm font-bold text-[#17365d] dark:text-white">{title}</h2>
        </div>
        <span className="text-xl font-bold text-[#17365d] dark:text-white">{value}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={bounded} aria-valuemin={0} aria-valuemax={100} aria-label={title}>
        <div className="h-full rounded-full bg-[#285487] transition-all" style={{ width: `${bounded}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{note}</p>
    </Link>
  );
}

export function AdminDashboardView() {
  const { user } = useAuth();
  const dashboard = useAdminDashboard();
  const data = dashboard.data;
  const gradeProgress = data?.gradeProgress.expectedEntries
    ? Math.min(100, data.gradeProgress.percentComplete)
    : 0;
  const attendanceCoverage = data?.attendanceToday.classesExpected
    ? Math.round((data.attendanceToday.classesWithRecords / data.attendanceToday.classesExpected) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-[#102747] px-5 py-6 text-white shadow-[0_10px_30px_rgba(16,39,71,0.14)] sm:px-8 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-24 size-72 rounded-full border-[34px] border-white/[0.045]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-40 size-64 rounded-full border-[24px] border-[#f3c64e]/[0.09]" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f3c64e]">School administration</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome back{user ? `, ${userDisplayName(user)}` : ""}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-100">
              A clear view of school operations, student enrollment, and today&apos;s priorities.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-blue-50">
              <CalendarCheck size={14} aria-hidden="true" className="text-[#f3c64e]" />
              {data?.context?.schoolYear.name ?? "School year not set"}
              {data?.context?.currentTerm && <><span className="text-white/40">/</span>{data.context.currentTerm.name}</>}
            </div>
          </div>
          <button type="button" onClick={() => void dashboard.refetch()} disabled={dashboard.isFetching}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3c64e] disabled:opacity-60">
            <RefreshCw size={16} aria-hidden="true" className={dashboard.isFetching ? "animate-spin" : ""} />
            {dashboard.isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </section>

      <section aria-label="Quick actions" className="flex flex-wrap items-center gap-3">
        <span className="mr-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Quick actions</span>
        <Link href="/admin/students" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#17365d] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#214978] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285487]">
          <Plus size={16} aria-hidden="true" /> Add student
        </Link>
        <Link href="/admin/enrollment" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d6b958] bg-[#fff7df] px-4 py-2 text-sm font-semibold text-[#6f5412] transition hover:bg-[#ffefbf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a78320]">
          <ClipboardCheck size={16} aria-hidden="true" /> Manage enrollment
        </Link>
        <Link href="/admin/sync" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#17365d] transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285487] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
          <Activity size={16} aria-hidden="true" /> Sync data
        </Link>
      </section>

      {dashboard.isError && <ErrorState title="Could not load the school dashboard" error={dashboard.error} retry={() => void dashboard.refetch()} />}

      {dashboard.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Loading dashboard metrics">
          {["Students", "Teachers", "Attendance", "Class sections", "Enrollment"].map((item) => (
            <div key={item} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-6 h-8 w-20 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-3 h-3 w-36 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      )}

      {!dashboard.isLoading && data && (
        <>
          <section aria-label="School overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Enrolled students" value={data.counts.enrolledStudents.toLocaleString()} note={`${data.counts.activeStudents.toLocaleString()} active students`} icon={Users} href="/admin/students" />
            <MetricCard label="Active teachers" value={data.counts.activeTeachers.toLocaleString()} note="Teaching staff with active accounts" icon={GraduationCap} href="/admin/teachers" />
            <MetricCard label="Attendance recorded" value={data.attendanceToday.rate === null ? "—" : `${Math.round(data.attendanceToday.rate)}%`} note={`${data.attendanceToday.classesWithRecords} of ${data.attendanceToday.classesExpected} classes reporting`} icon={CalendarCheck} href="/admin/sections" />
            <MetricCard label="Grade completion" value={`${gradeProgress}%`} note={`${data.gradeProgress.gradedEntries.toLocaleString()} grade entries recorded`} icon={BookOpen} href="/admin/school-years" />
            <MetricCard label="Unassigned students" value={data.counts.unassignedStudents.toLocaleString()} note="Active students without enrollment" icon={UserRoundX} href="/admin/enrollment" attention={data.counts.unassignedStudents > 0} />
          </section>

          {!data.context && (
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#ead59a] bg-[#fffaf0] p-5 dark:bg-amber-950/30">
              <div>
                <h2 className="font-bold text-[#17365d] dark:text-white">Set up the current school year</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Dashboard trends and class summaries will be available once a school year is active.</p>
              </div>
              <Link href="/admin/school-years" className="inline-flex min-h-10 items-center rounded-xl bg-[#17365d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#214978]">Manage school years</Link>
            </section>
          )}

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-[0_3px_14px_rgba(16,39,71,0.045)] dark:border-slate-700 dark:bg-slate-900">
              {data.context ? <EnrollmentChart data={data.enrollmentByGrade} /> : <EmptyState title="No enrollment overview yet" description="Set a current school year to see students by grade level." />}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-[0_3px_14px_rgba(16,39,71,0.045)] dark:border-slate-700 dark:bg-slate-900">
              {data.context ? <AttendanceTrendChart data={data.attendanceTrend} /> : <EmptyState title="No attendance trend yet" description="Attendance summaries will appear when school-year data is available." />}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <ProgressCard title="Attendance reporting today" value={attendanceCoverage} note={`${data.attendanceToday.classesWithRecords} of ${data.attendanceToday.classesExpected} classes have submitted attendance.`} href="/admin/sections" icon={CalendarCheck} />
                <ProgressCard title="Current term grades" value={gradeProgress} note={`${data.gradeProgress.incompleteClasses} classes still have incomplete grade entries.`} href="/admin/school-years" icon={CheckCircle2} />
              </div>
              {data.context && <SectionSizesChart data={data.sectionSizes} />}
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_3px_14px_rgba(16,39,71,0.045)] dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8a6710]">Stay on top of it</p>
                  <h2 className="mt-1 text-lg font-bold text-[#17365d] dark:text-white">Needs attention</h2>
                </div>
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#fff5d8] text-[#8a6710]"><Activity size={18} aria-hidden="true" /></span>
              </div>
              {data.needsAttention.length ? (
                <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                  {data.needsAttention.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-3.5">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={`mt-0.5 size-2 shrink-0 rounded-full ${item.severity === "warning" ? "bg-[#d19a1d]" : "bg-[#4773a4]"}`} />
                        <p className="text-sm leading-5 text-slate-700 dark:text-slate-200">{item.message} <strong className="text-[#17365d] dark:text-white">{item.count.toLocaleString()}</strong></p>
                      </div>
                      <Link href={item.href} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#285487] hover:bg-[#edf3fa] focus-visible:outline-2 focus-visible:outline-[#285487] dark:text-blue-200">Review</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#f2f8f4] p-4 text-sm font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <CheckCircle2 size={19} aria-hidden="true" /> Everything is up to date.
                </div>
              )}
            </section>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_3px_14px_rgba(16,39,71,0.045)] dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8a6710]">What&apos;s happening</p>
                <h2 className="mt-1 text-lg font-bold text-[#17365d] dark:text-white">Recent activity</h2>
              </div>
              <Link href="/admin/audit-logs" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#285487] hover:bg-[#edf3fa] focus-visible:outline-2 focus-visible:outline-[#285487] dark:text-blue-200">View audit log <span aria-hidden="true">→</span></Link>
            </div>
            {data.recentActivity.length ? (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentActivity.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#edf3fa] text-[#285487]">
                      <Activity size={16} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{ACTION_LABELS[item.action] ?? item.action.replaceAll("_", " ").toLowerCase()} <span className="font-normal text-slate-500">· {item.entity}</span></p>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{item.actor ? `${item.actor.email} · ${item.actor.role}` : "System"}</p>
                    </div>
                    <time className="shrink-0 text-xs text-slate-500 dark:text-slate-400" dateTime={item.createdAt} title={new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(item.createdAt))}>{relativeTime(item.createdAt)}</time>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No recent activity" description="Administrative activity will appear here." />}
          </section>
        </>
      )}
    </div>
  );
}
