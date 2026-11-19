"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, ClipboardCheck, Clock3, GraduationCap, LockKeyhole, RefreshCw, Users } from "lucide-react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { EmptyState, ErrorState } from "../../../components/shared";
import { RoleGuard } from "../../../components/RoleGuard";
import { userDisplayName } from "../../../lib/auth";
import { formatRate } from "../../../features/attendance/config";
import { GradeDistributionChart } from "../../../features/dashboard/charts";
import { ContextBadge, NoSchoolYearState, StatCard } from "../../../features/dashboard/components";
import { useTeacherDashboard } from "../../../features/dashboard/hooks";
import { weekdayOfDate } from "../../../lib/dates";
import { useAuth } from "../../../providers/AuthProvider";

function TeacherDashboardContent() {
  const { user } = useAuth();
  const dashboard = useTeacherDashboard();
  const data = dashboard.data;
  const sunday = data?.context ? weekdayOfDate(data.context.today) === 0 : false;
  const firstPending = data?.attendancePending.classOfferingIds[0];
  const firstClass = data?.classes[0]?.classOfferingId;
  const currentTermName = data?.context?.currentTerm?.name ?? "Current term";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,_#0d412e_0%,_#135b3b_30%,_#1d6a45_68%,_#0d412e_100%)] px-5 py-6 text-white shadow-[0_12px_32px_rgba(13,65,46,0.18)] sm:px-8 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-24 size-72 rounded-full border-[34px] border-white/[0.045]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-40 size-64 rounded-full border-[24px] border-[#f0c35d]/[0.09]" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f0c35d]">Teacher dashboard</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome back{user ? `, ${user.profile?.firstName ?? user.firstName ?? userDisplayName(user)}` : ""}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#dfeee4]">
              Classes, attendance, grade progress, and advisee support.
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
        <Link href={firstPending && !sunday ? `/teacher/classes/${firstPending}/attendance` : "/teacher/classes"} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1d6a45] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d412e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45]">
          <ClipboardCheck size={16} aria-hidden="true" /> Take attendance
        </Link>
        <Link href={firstClass ? `/teacher/classes/${firstClass}/grades` : "/teacher/grades"} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#f0c35d] bg-[#fff7e2] px-4 py-2 text-sm font-semibold text-[#6f5412] transition hover:bg-[#fff0b8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b89020]">
          <BookOpen size={16} aria-hidden="true" /> Enter grades
        </Link>
        <Link href="/teacher/advisees" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#0d412e] transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
          <Users size={16} aria-hidden="true" /> My advisees
        </Link>
      </section>

      {dashboard.isError && <ErrorState title="Could not load your dashboard" error={dashboard.error} retry={() => void dashboard.refetch()} />}
      {dashboard.isLoading && (
        <div className="space-y-5">
          <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-5">{["Classes", "Students", "Advisory", "Attendance pending today", "Advisee loans"].map((label) => <StatCard key={label} label={label} value="" loading />)}</div>
          <div className="h-96 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      )}
      {!dashboard.isLoading && !dashboard.isError && data && (
        <>
          {!data.context && <NoSchoolYearState />}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Classes" value={data.counts.classes.toLocaleString()} icon={BookOpen} href="/teacher/classes" />
            <StatCard label="Students across classes" value={data.counts.studentsTotal.toLocaleString()} helper="Students summed across each assigned class" icon={Users} href="/teacher/classes" />
            <StatCard label="Advisory" value={data.counts.advisorySection?.label ?? "None"} helper={data.counts.advisorySection ? `${data.counts.advisorySection.students.toLocaleString()} enrolled students` : "No advisory section assigned"} icon={GraduationCap} href="/teacher/advisees" valueClassName="text-lg" />
            <StatCard label="Attendance pending today" value={data.attendancePending.count.toLocaleString()} helper={sunday ? "Attendance actions are hidden on Sundays" : "Classes with unmarked students"} icon={Clock3} href={firstPending ? `/teacher/classes/${firstPending}/attendance` : "/teacher/classes"} warning={data.attendancePending.count > 0} />
            <StatCard label="Advisee overdue loans" value={data.libraryLoans.overdue.toLocaleString()} helper={`${data.libraryLoans.borrowed.toLocaleString()} current loans`} icon={BookOpen} href="/teacher/advisory/library" warning={data.libraryLoans.overdue > 0} />
          </div>

          {data.context && !data.counts.classes ? (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <EmptyState title="No classes assigned yet" description="Contact the administrator if you expect to teach a class this school year." action={<Link href="/teacher/classes" className="font-semibold text-[#1d6a45] hover:underline dark:text-[#dfeee4]">Open my classes</Link>} />
            </section>
          ) : data.context ? (
            <>
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Today</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Attendance and current-term grade progress for each class.</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {data.classes.map((classItem) => (
                    <article key={classItem.classOfferingId} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.1fr_1.2fr_1fr] lg:items-center">
                      <Link href={`/teacher/classes/${classItem.classOfferingId}`} className="min-w-0 rounded focus-visible:outline-2 focus-visible:outline-[#1d6a45]">
                        <p className="font-semibold text-slate-900 dark:text-white">{classItem.subjectName}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{classItem.sectionLabel}</p>
                        <p className="mt-1 text-xs font-medium text-[#1d6a45] dark:text-[#dfeee4]">{classItem.students.toLocaleString()} students</p>
                      </Link>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Attendance today</p>
                        {classItem.attendanceToday.complete ? (
                          <p className="mt-1 inline-flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={16} aria-hidden="true" /> Complete · {classItem.attendanceToday.marked} of {classItem.attendanceToday.expected} marked</p>
                        ) : (
                          <div className="mt-1">
                            <p className="inline-flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300"><Clock3 size={16} aria-hidden="true" /> {classItem.attendanceToday.recorded ? `Partial · ${classItem.attendanceToday.marked} of ${classItem.attendanceToday.expected} marked` : "Not recorded yet"}</p>
                            {!sunday && <Link href={`/teacher/classes/${classItem.classOfferingId}/attendance`} className="ml-2 inline-flex items-center gap-1 rounded-lg bg-[#1d6a45] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d412e]"><ClipboardCheck size={14} aria-hidden="true" /> {classItem.attendanceToday.recorded ? "Complete attendance" : "Take attendance"}</Link>}
                          </div>
                        )}
                        <Link href={`/teacher/classes/${classItem.classOfferingId}/attendance/summary`} className="mt-1 inline-block text-xs text-[#1d6a45] hover:underline dark:text-[#dfeee4]">Current term rate: {formatRate(classItem.attendanceRate)}</Link>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Grades · {currentTermName}</p>
                        <Link href={`/teacher/classes/${classItem.classOfferingId}/grades`} className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-[#1d6a45] dark:text-slate-100 dark:hover:text-[#dfeee4]">
                          {classItem.gradesCurrentTerm.graded.toLocaleString()} of {classItem.gradesCurrentTerm.expected.toLocaleString()} graded
                          {classItem.gradesCurrentTerm.locked && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"><LockKeyhole size={13} aria-hidden="true" /> Locked</span>}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <div className="grid gap-5 xl:grid-cols-2">
                <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Students to follow up</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Students with attendance below 90% in your classes this quarter.</p>
                  {data.atRisk.length ? (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <caption className="sr-only">Students flagged for attendance follow-up</caption>
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr><th scope="col" className="px-3 py-2">Name</th><th scope="col" className="px-3 py-2">Student no.</th><th scope="col" className="px-3 py-2">Subject</th><th scope="col" className="px-3 py-2">Rate</th></tr></thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">{data.atRisk.map((student) => <tr key={`${student.studentId}-${student.classOfferingId}`}><td className="px-3 py-3"><Link className="font-semibold text-[#1d6a45] hover:underline dark:text-[#dfeee4]" href={`/teacher/classes/${student.classOfferingId}/attendance/summary`}>{student.name}</Link></td><td className="px-3 py-3 text-slate-600 dark:text-slate-300">{student.studentNo}</td><td className="px-3 py-3 text-slate-600 dark:text-slate-300">{student.subjectName}</td><td className="px-3 py-3"><Link className="font-semibold text-rose-700 hover:underline dark:text-rose-300" href={`/teacher/classes/${student.classOfferingId}/attendance/summary`}>{formatRate(student.rate)}</Link></td></tr>)}</tbody>
                      </table>
                    </div>
                  ) : <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">No students need follow-up.</p>}
                </section>
                <GradeDistributionChart data={data.gradeDistribution} />
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function TeacherDashboardPage() {
  return <RoleGuard allowedRoles={["TEACHER"]}><DashboardLayout><TeacherDashboardContent /></DashboardLayout></RoleGuard>;
}
