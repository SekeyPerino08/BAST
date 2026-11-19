"use client";

import Link from "next/link";
import { BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, FileText, GraduationCap, RefreshCw, XCircle } from "lucide-react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { EmptyState, ErrorState, StatusBadge } from "../../../components/shared";
import { RoleGuard } from "../../../components/RoleGuard";
import { formatRate, STATUS_CONFIG } from "../../../features/attendance/config";
import { ContextBadge, NoSchoolYearState, StatCard } from "../../../features/dashboard/components";
import { useStudentDashboard } from "../../../features/dashboard/hooks";
import { formatDisplayDate } from "../../../lib/dates";
import { useAuth } from "../../../providers/AuthProvider";
import { userDisplayName } from "../../../lib/auth";

function GradeBadge({ score }: Readonly<{ score: number }>) {
  const passing = score >= 75;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${passing ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"}`}>
      {passing ? <CheckCircle2 size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
      {score.toFixed(2)} · {passing ? "Passing" : "Below 75"}
    </span>
  );
}

function StudentDashboardContent() {
  const { user } = useAuth();
  const dashboard = useStudentDashboard();
  const data = dashboard.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
    <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,_#0d412e_0%,_#135b3b_30%,_#1d6a45_68%,_#0d412e_100%)] px-5 py-6 text-white shadow-[0_12px_32px_rgba(13,65,46,0.18)] sm:px-8 sm:py-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-24 size-72 rounded-full border-[34px] border-white/[0.045]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-40 size-64 rounded-full border-[24px] border-[#f0c35d]/[0.09]" />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f0c35d]">Student dashboard</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome{user ? `, ${userDisplayName(user)}` : ""}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#dfeee4]">
            Your enrollment, released grades, and attendance.
          </p>
          {dashboard.dataUpdatedAt > 0 && (
            <p className="mt-3 text-xs text-white/75">
              Last updated {new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(new Date(dashboard.dataUpdatedAt))}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void dashboard.refetch()}
          disabled={dashboard.isFetching}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
        >
          <RefreshCw size={16} aria-hidden="true" className={dashboard.isFetching ? "animate-spin" : ""} />
          {dashboard.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </section>
      <ContextBadge context={data?.context ?? null} />

    <section aria-label="Quick actions" className="flex flex-wrap items-center gap-3">
      <span className="mr-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Quick actions</span>
      <Link href="/student/subjects" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1d6a45] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d412e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45]">
        <GraduationCap size={16} aria-hidden="true" /> My subjects
      </Link>
      <Link href="/student/grades" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#f0c35d] bg-[#fff7e2] px-4 py-2 text-sm font-semibold text-[#6f5412] transition hover:bg-[#fff0b8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b89020]">
        <BookOpen size={16} aria-hidden="true" /> Check grades
      </Link>
      <Link href="/student/attendance" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#0d412e] transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
        <ClipboardCheck size={16} aria-hidden="true" /> Attendance
      </Link>
    </section>

      {dashboard.isError && <ErrorState title="Could not load your dashboard" error={dashboard.error} retry={() => void dashboard.refetch()} />}
      {dashboard.isLoading && (
        <div className="space-y-5">
          <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-5">{["Section and adviser", "Attendance rate", "General average", "Report card", "Library loans"].map((label) => <StatCard key={label} label={label} value="" loading />)}</div>
          <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      )}
      {!dashboard.isLoading && !dashboard.isError && data && (
        <>
          {!data.context && <NoSchoolYearState />}
          {!data.enrollment && (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
              <EmptyState title="You are not enrolled yet" description="Your school-year dashboard will be available after the registrar completes your enrollment." action={<Link href="/student/subjects" className="font-semibold text-[#1d6a45] hover:underline dark:text-[#dfeee4]">View my subjects</Link>} />
            </section>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Section and adviser"
              value={data.enrollment?.sectionLabel ?? "Not enrolled"}
              helper={data.enrollment?.adviserName ? `Adviser: ${data.enrollment.adviserName}` : "Adviser not assigned"}
              icon={GraduationCap}
              href="/student/subjects"
              valueClassName="text-lg"
            />
            <StatCard
              label="Attendance rate this school year"
              value={formatRate(data.attendance.overallRate)}
              helper={`Current term: ${formatRate(data.attendance.currentTermRate)}`}
              icon={ClipboardCheck}
              href="/student/attendance"
            />
            <Link href="/student/grades" className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#1d6a45]">
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_3px_14px_rgba(13,65,46,0.06)] transition hover:border-[#b9d7bf] hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-slate-500 dark:text-slate-400">General average</p><BookOpen size={19} className="text-[#1d6a45] dark:text-[#dfeee4]" aria-hidden="true" /></div>
                <p className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{data.grades.generalAverage === null ? "No released grades yet" : `${data.grades.generalAverage.toFixed(2)}%`}</p>
                {data.grades.generalAverage !== null && <div className="mt-2"><GradeBadge score={data.grades.generalAverage} /></div>}
                {data.grades.latestReleasedTerm && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Latest released: {data.grades.latestReleasedTerm.name} · {data.grades.latestReleasedTerm.average === null ? "No scores" : `${data.grades.latestReleasedTerm.average.toFixed(2)}%`}</p>}
              </div>
            </Link>
            {data.reportCardAvailable ? (
              <Link href="/student/report-card" className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#1d6a45]">
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_3px_14px_rgba(13,65,46,0.06)] transition hover:border-[#b9d7bf] hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-slate-500 dark:text-slate-400">Report card</p><FileText size={19} className="text-[#1d6a45] dark:text-[#dfeee4]" aria-hidden="true" /></div>
                  <p className="mt-4 text-lg font-bold text-slate-900 dark:text-white">View report card</p>
                  <span className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#1d6a45] px-3 py-2 text-sm font-semibold text-white"><FileText size={15} aria-hidden="true" /> Open</span>
                </div>
              </Link>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-slate-500 dark:text-slate-400">Report card</p><FileText size={19} className="text-slate-400" aria-hidden="true" /></div>
                <p className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Not available</p>
                <button type="button" disabled aria-describedby="report-card-unavailable-reason" className="mt-2 cursor-not-allowed rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">Open</button>
                <p id="report-card-unavailable-reason" className="mt-2 text-xs text-slate-500 dark:text-slate-400">A report card will be available after enrollment.</p>
              </div>
            )}
            <StatCard
              label="Library loans"
              value={(data.libraryLoans.borrowed + data.libraryLoans.overdue).toLocaleString()}
              helper={`${data.libraryLoans.overdue} overdue`}
              icon={BookOpen}
              href="/student/integrations"
              warning={data.libraryLoans.overdue > 0}
            />
          </div>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="font-semibold text-slate-900 dark:text-white">Recent absences and lates</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your five most recent records that need attention.</p></div>
                <Link href="/student/attendance" className="text-sm font-semibold text-[#1d6a45] hover:underline dark:text-[#dfeee4]">Attendance details</Link>
              </div>
              {data.attendance.recentAbsences.length ? (
                <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
                  {data.attendance.recentAbsences.map((record, index) => {
                    const status = STATUS_CONFIG[record.status];
                    const Icon = status.icon;
                    return (
                      <li key={`${record.date}-${record.subjectName}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <Link href="/student/attendance" className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900 hover:text-[#1d6a45] dark:text-white dark:hover:text-[#dfeee4]">{record.subjectName}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDisplayDate(record.date)}</p>
                        </Link>
                        <Link href="/student/attendance" aria-label={`${status.label} attendance record for ${record.subjectName} on ${formatDisplayDate(record.date)}`} className="inline-flex items-center gap-1.5">
                          <Icon size={16} aria-hidden="true" className={record.status === "ABSENT" ? "text-rose-700" : "text-amber-700"} />
                          <StatusBadge label={status.label} color={record.status === "ABSENT" ? "red" : "yellow"} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">No recent absences.</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="font-semibold text-slate-900 dark:text-white">Grades overview</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400"><Link href="/student/grades" className="hover:text-[#1d6a45] hover:underline dark:hover:text-[#dfeee4]">Released terms: {data.grades.releasedTerms.toLocaleString()}</Link></p></div>
                <Link href="/student/grades" className="text-sm font-semibold text-[#1d6a45] hover:underline dark:text-[#dfeee4]">View my grades</Link>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Only released grades are shown.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Link href="/student/grades" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 focus-visible:outline-2 focus-visible:outline-emerald-700 dark:border-emerald-800 dark:bg-emerald-950">
                  <p className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200"><CheckCircle2 size={16} aria-hidden="true" /> Subjects passed</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-100">{data.grades.subjectsPassed.toLocaleString()}</p>
                </Link>
                <Link href="/student/grades" className="rounded-xl border border-rose-200 bg-rose-50 p-4 focus-visible:outline-2 focus-visible:outline-rose-700 dark:border-rose-800 dark:bg-rose-950">
                  <p className="flex items-center gap-2 text-sm font-medium text-rose-800 dark:text-rose-200"><XCircle size={16} aria-hidden="true" /> Subjects below 75</p>
                  <p className="mt-2 text-2xl font-bold text-rose-900 dark:text-rose-100">{data.grades.subjectsBelowPassing.toLocaleString()}</p>
                </Link>
              </div>
              {!data.grades.releasedTerms && <p className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><CalendarDays size={16} aria-hidden="true" /> Grades will appear after a term is released.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function StudentDashboardPage() {
  return <RoleGuard allowedRoles={["STUDENT"]}><DashboardLayout><StudentDashboardContent /></DashboardLayout></RoleGuard>;
}
