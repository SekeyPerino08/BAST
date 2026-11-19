"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, BookOpen, Search, Users } from "lucide-react";
import { EmptyState, ErrorState } from "../../../components/shared";
import type { TeacherAdvisee } from "../api";
import { useMyAdvisees } from "../hooks";

type AdviseeFilter = "all" | "attendance" | "grades" | "no-grades";
const EMPTY_STUDENTS: TeacherAdvisee[] = [];

function studentName(student: TeacherAdvisee) {
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
}

function attendanceLabel(student: TeacherAdvisee) {
  if (!student.attendance.total) return "No attendance yet";
  if (student.attendance.present + student.attendance.absent + student.attendance.late < 5) return "Building history";
  return student.needsAttendanceFollowUp ? "Follow up" : "On track";
}

export function TeacherAdviseesView() {
  const query = useMyAdvisees();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AdviseeFilter>("all");
  const students = query.data?.students ?? EMPTY_STUDENTS;

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return students.filter((student) => {
      const matchesSearch = !term
        || `${student.studentNo} ${student.firstName} ${student.middleName ?? ""} ${student.lastName}`
          .toLocaleLowerCase()
          .includes(term);
      const matchesFilter = filter === "all"
        || (filter === "attendance" && student.needsAttendanceFollowUp)
        || (filter === "grades" && student.recentGrades.length > 0)
        || (filter === "no-grades" && student.recentGrades.length === 0);
      return matchesSearch && matchesFilter;
    });
  }, [filter, search, students]);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-7xl animate-pulse space-y-5">
        <div className="h-20 rounded-2xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-24 rounded-2xl bg-slate-200" />)}
        </div>
        <div className="h-96 rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Could not load your advisees"
        error={query.error}
        retry={() => void query.refetch()}
      />
    );
  }

  const data = query.data;
  const attendanceFollowUps = students.filter((student) => student.needsAttendanceFollowUp).length;
  const studentsWithGrades = students.filter((student) => student.recentGrades.length > 0).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1d6a45] dark:text-[#dfeee4]">Advisory</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">My Advisees</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.section
              ? `Grade ${data.section.gradeLevel} · ${data.section.name} · ${data.schoolYear?.name ?? "Current school year"}`
              : "Students in your current advisory section"}
          </p>
        </div>
        {data.section && (
          <Link
            href="/teacher/advisory/report-cards"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <BookOpen size={16} aria-hidden="true" />
            Batch report cards
          </Link>
        )}
      </header>

      {!data.schoolYear ? (
        <EmptyState title="No current school year" description="A current school year must be set before advisees can be shown." />
      ) : !data.section ? (
        <EmptyState title="No advisory section assigned" description="Contact the administrator if you expected to be assigned as an adviser." />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3" aria-label="Advisee summary">
            <SummaryCard label="Enrolled advisees" value={students.length} icon={<Users size={18} aria-hidden="true" />} />
            <SummaryCard label="Attendance follow-up" value={attendanceFollowUps} warning />
            <SummaryCard
              label={data.recentGradeTerm ? `Grades available · ${data.recentGradeTerm.name}` : "Released grades"}
              value={studentsWithGrades}
              helper={data.recentGradeTerm ? "Students with at least one released grade" : "No term grades have been released"}
            />
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-700">
              <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
                <span className="sr-only">Search advisees</span>
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name or student number"
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter advisees">
                {([
                  ["all", "All"],
                  ["attendance", "Attendance follow-up"],
                  ["grades", "Grades available"],
                  ["no-grades", "No recent grades"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${
                      filter === value
                        ? "border-[#1d6a45] bg-[#edf7ef] text-[#0d412e] dark:border-[#7da88b] dark:bg-[#183d2d] dark:text-[#dfeee4]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length ? (
              <>
                <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-700">
                  {filtered.map((student) => <AdviseeCard key={student.id} student={student} gradeTerm={data.recentGradeTerm?.name} />)}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      <tr>
                        <th scope="col" className="px-5 py-3">Student</th>
                        <th scope="col" className="px-5 py-3">Attendance · {data.currentTerm?.name ?? "Current term"}</th>
                        <th scope="col" className="px-5 py-3">Recent grades · {data.recentGradeTerm?.name ?? "Not released"}</th>
                        <th scope="col" className="px-5 py-3">Status</th>
                        <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {filtered.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800">
                          <td className="px-5 py-4">
                            <Link
                              href={`/teacher/advisory/report-cards/${student.id}`}
                              className="font-semibold text-[#1d6a45] hover:underline dark:text-[#dfeee4]"
                            >
                              {student.lastName}, {student.firstName}{student.middleName ? ` ${student.middleName.charAt(0)}.` : ""}
                            </Link>
                            <p className="mt-1 text-xs text-slate-500">{student.studentNo}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {student.attendance.rate === null ? "No records" : `${student.attendance.rate.toFixed(1)}%`}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {student.attendance.absent} absent · {student.attendance.late} late · {student.attendance.total} records
                            </p>
                          </td>
                          <td className="px-5 py-4"><RecentGrades student={student} gradeTerm={data.recentGradeTerm?.name} /></td>
                          <td className="px-5 py-4"><AttendanceStatus student={student} /></td>
                          <td className="px-5 py-4">
                            <Link
                              href={`/teacher/advisory/report-cards/${student.id}`}
                              aria-label={`View ${studentName(student)}'s report card`}
                              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              View <ArrowUpRight size={14} aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-sm text-slate-500">
                {students.length ? "No advisees match these filters." : "No students are enrolled in this advisory section yet."}
              </div>
            )}
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-700">
              Showing {filtered.length} of {students.length} students
              {data.attendancePeriod ? ` · Attendance ${data.attendancePeriod.from} to ${data.attendancePeriod.to}` : ""}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  warning = false,
  helper,
}: Readonly<{
  label: string;
  value: number;
  icon?: ReactNode;
  warning?: boolean;
  helper?: string;
}>) {
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${
      warning
        ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
        {icon && <span className="text-[#1d6a45] dark:text-[#dfeee4]">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value.toLocaleString()}</p>
      {helper && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</p>}
    </article>
  );
}

function AttendanceStatus({ student }: Readonly<{ student: TeacherAdvisee }>) {
  const followUp = student.needsAttendanceFollowUp;
  const countable = student.attendance.present + student.attendance.absent + student.attendance.late;
  const insufficientHistory = student.attendance.total === 0 || countable < 5;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
      insufficientHistory
        ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        : followUp
          ? "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
    }`}>
      {attendanceLabel(student)}
    </span>
  );
}

function RecentGrades({ student, gradeTerm }: Readonly<{ student: TeacherAdvisee; gradeTerm?: string }>) {
  if (!gradeTerm) return <span className="text-xs text-slate-500">No released grades</span>;
  if (!student.recentGrades.length) return <span className="text-xs text-slate-500">No grades available</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {student.recentGrades.slice(0, 3).map((grade) => {
        const label = `${grade.subject.code} ${grade.score === null ? "—" : grade.score.toFixed(1)}`;
        return grade.teacherAssigned ? (
          <Link
            key={grade.classOfferingId}
            href={`/teacher/classes/${grade.classOfferingId}/grades`}
            className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-[#1d6a45] hover:underline dark:bg-slate-800 dark:text-[#dfeee4]"
          >
            {label}
          </Link>
        ) : (
          <span key={grade.classOfferingId} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {label}
          </span>
        );
      })}
      {student.recentGrades.length > 3 && (
        <span className="self-center text-xs text-slate-500">+{student.recentGrades.length - 3}</span>
      )}
    </div>
  );
}

function AdviseeCard({ student, gradeTerm }: Readonly<{ student: TeacherAdvisee; gradeTerm?: string }>) {
  return (
    <article className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/teacher/advisory/report-cards/${student.id}`}
            className="font-semibold text-[#1d6a45] hover:underline dark:text-[#dfeee4]"
          >
            {student.lastName}, {student.firstName}{student.middleName ? ` ${student.middleName.charAt(0)}.` : ""}
          </Link>
          <p className="mt-1 text-xs text-slate-500">{student.studentNo} · Enrolled</p>
        </div>
        <AttendanceStatus student={student} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-medium text-slate-500">Term attendance</p>
          <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
            {student.attendance.rate === null ? "No records" : `${student.attendance.rate.toFixed(1)}%`}
          </p>
          <p className="text-xs text-slate-500">{student.attendance.absent} absent · {student.attendance.late} late</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Recent grades · {gradeTerm ?? "Not released"}</p>
          <div className="mt-1"><RecentGrades student={student} gradeTerm={gradeTerm} /></div>
        </div>
      </div>
      <Link
        href={`/teacher/advisory/report-cards/${student.id}`}
        className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[#1d6a45] dark:text-[#dfeee4]"
      >
        View student report <ArrowUpRight size={15} aria-hidden="true" />
      </Link>
    </article>
  );
}
