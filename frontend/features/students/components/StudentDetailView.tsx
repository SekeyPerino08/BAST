"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Banknote,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  KeyRound,
  LoaderCircle,
  Mail,
  Pencil,
  ShieldAlert,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "../../../lib/api";
import type { ReportCard } from "../../../types/report-card";
import type { StudentDetail } from "../../../types/student";
import { useStudentReportCard } from "../../report-card/hooks";
import { resetUserPassword } from "../../users/api";
import { useStudent } from "../hooks";
import { ChangeStatusDialog } from "./ChangeStatusDialog";
import { CreateAccountDialog } from "./CreateAccountDialog";
import { StudentFormDialog } from "./StudentFormDialog";
import { StudentStatusBadge } from "./StudentStatusBadge";
import { QuickEnrollDialog } from "../../enrollment/components/EnrollmentDialogs";
import { StudentIntegrations } from "../../integrations/components/StudentIntegrations";
import { ConfirmDialog, friendlyApiMessage } from "../../../components/shared";

type DetailTab = "overview" | "academic" | "attendance" | "grades" | "fees" | "documents" | "activity";

const tabs: { id: DetailTab; label: string; icon: typeof UserRound }[] = [
  { id: "overview", label: "Overview", icon: UserRound },
  { id: "academic", label: "Academic", icon: BookOpen },
  { id: "attendance", label: "Attendance", icon: CalendarDays },
  { id: "grades", label: "Grades", icon: ClipboardList },
  { id: "fees", label: "Fees & payments", icon: Banknote },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "activity", label: "Activity log", icon: ShieldAlert },
];

export function StudentDetailView({ id }: Readonly<{ id: string }>) {
  const query = useStudent(id);
  const [dialog, setDialog] = useState<"edit" | "status" | "account" | "enrollment" | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [resetPending, setResetPending] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  if (query.isLoading) return <StudentDetailSkeleton />;

  if (query.isError || !query.data) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="mx-auto flex min-h-[65vh] max-w-5xl items-center justify-center">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-[#b17d00]">
            <ShieldAlert size={26} aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight text-[#0d412e]">Could not load student information</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
            {notFound
              ? "We couldn't find a student record at this address. It may have been removed, or the link may be incorrect."
              : "The student record could not be retrieved right now. Check your connection and try again."}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0d412e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#135b3b] disabled:cursor-wait disabled:opacity-70"
            >
              {query.isFetching && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              Retry
            </button>
            <Link
              href="/admin/students"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Students List
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const student = query.data;
  const fullName = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
  const currentEnrollment = student.currentEnrollment;
  const gradeAndSection = currentEnrollment?.section
    ? `Grade ${currentEnrollment.section.gradeLevel} · ${currentEnrollment.section.name}`
    : "Not currently enrolled";

  async function sendPasswordReset() {
    if (!student.userId) return;
    setResetPending(true);
    try {
      await resetUserPassword(student.userId);
      setResetDialogOpen(false);
      toast.success("Password reset instructions sent");
    } catch (error) {
      toast.error(friendlyApiMessage(error, "Could not send password reset instructions"));
    } finally {
      setResetPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/students"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-[#1d6a45] transition hover:text-[#0d412e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1d6a45]"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Back to Students
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Student record</p>
      </div>

      <header className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#102747] sm:text-3xl">{fullName}</h1>
            <StudentStatusBadge status={student.status} />
          </div>
          <p className="mt-1.5 text-sm text-slate-600">Student profile and school record</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setResetDialogOpen(true)}
            disabled={!student.userId}
            title={!student.userId ? "Create a login account before resetting its password" : undefined}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <KeyRound size={16} aria-hidden="true" />
            Reset password
          </button>
          <button
            type="button"
            onClick={() => setDialog("status")}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100"
          >
            {student.status === "ACTIVE" ? "Deactivate" : "Manage status"}
          </button>
          <button
            type="button"
            onClick={() => setDialog("edit")}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0d412e] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#135b3b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45]"
          >
            <Pencil size={16} aria-hidden="true" />
            Edit student
          </button>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-hidden bg-gradient-to-r from-[#0d412e] via-[#135b3b] to-[#1d6a45] px-5 py-6 text-white sm:px-7 sm:py-7">
          <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full border-[34px] border-white/5" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/10 text-3xl font-bold tracking-wide text-[#ffdb74] shadow-inner">
              {getInitials(student.firstName, student.lastName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Student profile</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{fullName}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <ProfileChip icon={<ClipboardList size={15} />} label={`LRN ${student.studentNo}`} />
                <ProfileChip icon={<BookOpen size={15} />} label={gradeAndSection} />
                {currentEnrollment && <ProfileChip icon={<CalendarDays size={15} />} label={currentEnrollment.schoolYear.name} />}
                <ProfileChip icon={<Check size={15} />} label={formatStatus(student.status)} />
              </div>
            </div>
            <div className="grid min-w-[190px] grid-cols-2 gap-3 sm:grid-cols-1">
              <ProfileFact label="Gender" value={student.sex === "MALE" ? "Male" : "Female"} />
              <ProfileFact label="Age" value={calculateAge(student.birthDate)} />
              <ProfileFact label="Date of birth" value={formatDate(student.birthDate)} />
            </div>
          </div>
        </div>

        <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <SummaryFact label="Learner reference number" value={student.studentNo} highlight />
          <SummaryFact label="Grade level & section" value={gradeAndSection} />
          <SummaryFact label="School year" value={currentEnrollment?.schoolYear.name ?? "No current enrollment"} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto border-b border-slate-200">
          <div className="flex min-w-max gap-1 px-3 pt-2" role="tablist" aria-label="Student information sections">
            {tabs.map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                id={`student-tab-${tabId}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tabId}
                aria-controls="student-tab-panel"
                onClick={() => setActiveTab(tabId)}
                className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${
                  activeTab === tabId
                    ? "border-[#d4a72c] text-[#0d412e]"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div id="student-tab-panel" role="tabpanel" aria-labelledby={`student-tab-${activeTab}`} className="p-4 sm:p-6">
          {activeTab === "overview" && (
            <OverviewPanel
              student={student}
              onCreateAccount={() => setDialog("account")}
              onEnroll={() => setDialog("enrollment")}
            />
          )}
          {activeTab === "academic" && (
            <AcademicPanel
              student={student}
              onEnroll={() => setDialog("enrollment")}
            />
          )}
          {activeTab === "attendance" && <StudentReportPanel studentId={student.id} type="attendance" />}
          {activeTab === "grades" && <StudentReportPanel studentId={student.id} type="grades" />}
          {activeTab === "fees" && <UnavailablePanel icon={<Banknote size={20} />} title="Fees & payments" description="Fee balances and payment history are not currently available in the student record." />}
          {activeTab === "documents" && <UnavailablePanel icon={<FileText size={20} />} title="Student documents" description="Document uploads and storage have not been set up for this student record yet." />}
          {activeTab === "activity" && (
            <div className="space-y-5">
              <UnavailablePanel icon={<ShieldAlert size={20} />} title="Student activity log" description="Student-specific audit events are not currently displayed on this page. Administrative system events remain available in the audit log." />
              <StudentIntegrations studentId={student.id} />
            </div>
          )}
        </div>
      </section>

      {dialog === "edit" && <StudentFormDialog student={student} onClose={() => { setDialog(null); void query.refetch(); }} />}
      {dialog === "status" && <ChangeStatusDialog studentId={student.id} currentStatus={student.status} onClose={() => { setDialog(null); void query.refetch(); }} />}
      {dialog === "account" && <CreateAccountDialog studentId={student.id} onClose={() => { setDialog(null); void query.refetch(); }} />}
      {dialog === "enrollment" && <QuickEnrollDialog studentId={student.id} onClose={() => { setDialog(null); void query.refetch(); }} />}
      {resetDialogOpen && (
        <ConfirmDialog
          title="Send password reset instructions?"
          description="A single-use password reset link will be sent to the email address on the student's account. Existing sessions are invalidated after the password is changed."
          onClose={() => setResetDialogOpen(false)}
          onConfirm={() => void sendPasswordReset()}
          loading={resetPending}
          confirmLabel="Send reset link"
        />
      )}
    </div>
  );
}

function OverviewPanel({
  student,
  onCreateAccount,
  onEnroll,
}: Readonly<{
  student: StudentDetail;
  onCreateAccount: () => void;
  onEnroll: () => void;
}>) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <InfoCard title="Personal information" icon={<UserRound size={18} />}>
        <Detail label="Full name" value={[student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ")} />
        <Detail label="LRN" value={student.studentNo} emphasized />
        <Detail label="Gender" value={student.sex === "MALE" ? "Male" : "Female"} />
        <Detail label="Date of birth" value={formatDate(student.birthDate)} />
        <Detail label="Age" value={calculateAge(student.birthDate)} />
        <Detail label="Home address" value={student.address} />
      </InfoCard>
      <InfoCard title="Parent / guardian & contact" icon={<UsersRound size={18} />}>
        <Detail label="Parent / guardian" value={student.guardianName} />
        <Detail label="Contact number" value={student.guardianContact} />
        <p className="pt-1 text-xs leading-5 text-slate-500">The listed guardian contact is the contact information currently on file.</p>
      </InfoCard>
      <InfoCard title="Student account" icon={<Mail size={18} />}>
        {student.user ? (
          <>
            <Detail label="Email address" value={student.user.email} />
            <Detail label="Account status" value={student.user.isActive === undefined ? "Not provided" : student.user.isActive ? "Active" : "Disabled"} />
          </>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm leading-6 text-slate-600">No sign-in account is linked to this student yet.</p>
            <ActionButton onClick={onCreateAccount}>Create student account</ActionButton>
          </div>
        )}
      </InfoCard>
      <InfoCard title="Current enrollment" icon={<CalendarDays size={18} />}>
        {student.currentEnrollment ? (
          <>
            <Detail label="School year" value={student.currentEnrollment.schoolYear.name} />
            <Detail label="Grade level" value={student.currentEnrollment.section ? `Grade ${student.currentEnrollment.section.gradeLevel}` : null} />
            <Detail label="Section" value={student.currentEnrollment.section?.name} />
            <Detail label="Enrollment status" value={student.currentEnrollment.status ?? "Enrolled"} />
          </>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm leading-6 text-slate-600">There is no enrollment in the current school year.</p>
            <ActionButton onClick={onEnroll}>Enroll in a section</ActionButton>
          </div>
        )}
      </InfoCard>
    </div>
  );
}

function AcademicPanel({
  student,
  onEnroll,
}: Readonly<{
  student: StudentDetail;
  onEnroll: () => void;
}>) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#dce5ef] bg-[#f7f9fc] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Current placement</p>
          <p className="mt-2 text-lg font-bold text-[#102747]">
            {student.currentEnrollment?.section
              ? `Grade ${student.currentEnrollment.section.gradeLevel} · ${student.currentEnrollment.section.name}`
              : "No active enrollment"}
          </p>
          <p className="mt-1 text-sm text-slate-600">{student.currentEnrollment?.schoolYear.name ?? "Current school year"}</p>
          {!student.currentEnrollment && <ActionButton onClick={onEnroll}>Enroll in a section</ActionButton>}
        </div>
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-[#e9dfc2] bg-[#fffaf0] p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-900">Report card</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">Review released subject grades and term attendance for this student.</p>
          </div>
          <Link
            href={`/admin/students/${encodeURIComponent(student.id)}/report-card`}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0d412e] px-4 text-sm font-semibold text-white transition hover:bg-[#135b3b]"
          >
            <BookOpen size={16} aria-hidden="true" />
            Open report card
          </Link>
        </div>
      </div>
      <EnrollmentHistory student={student} />
    </div>
  );
}

function EnrollmentHistory({ student }: Readonly<{ student: StudentDetail }>) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200">
      <header className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold text-[#102747]">Enrollment history</h2>
        <p className="mt-1 text-xs text-slate-500">Section placements recorded for this student.</p>
      </header>
      {student.enrollments.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">School year</th><th className="px-5 py-3">Grade</th><th className="px-5 py-3">Section</th><th className="px-5 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {student.enrollments.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td className="px-5 py-3 font-semibold text-slate-800">{enrollment.schoolYear.name}</td>
                  <td className="px-5 py-3 text-slate-600">{enrollment.section ? `Grade ${enrollment.section.gradeLevel}` : "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{enrollment.section?.name ?? "—"}</td>
                  <td className="px-5 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{enrollment.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="px-5 py-8 text-center text-sm text-slate-500">No enrollment history is available.</p>}
    </section>
  );
}

function StudentReportPanel({ studentId, type }: Readonly<{ studentId: string; type: "grades" | "attendance" }>) {
  const report = useStudentReportCard(studentId);
  const title = type === "grades" ? "Current grades" : "Attendance summary";

  if (report.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 w-56 rounded bg-slate-200" /><div className="h-44 rounded-2xl bg-slate-100" /><div className="h-28 rounded-2xl bg-slate-100" /></div>;
  }
  if (report.isError || !report.data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h2 className="font-semibold text-rose-950">Could not load {type === "grades" ? "grades" : "attendance"}</h2>
        <p className="mt-1 text-sm text-rose-800">The student record is available, but this report could not be retrieved.</p>
        <button type="button" onClick={() => void report.refetch()} className="mt-4 rounded-lg bg-[#0d412e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#135b3b]">Retry report</button>
      </div>
    );
  }

  return type === "grades"
    ? <GradesSummary data={report.data} />
    : <AttendanceSummary data={report.data} title={title} />;
}

function GradesSummary({ data }: Readonly<{ data: ReportCard }>) {
  const terms = [...data.terms].sort((a, b) => a.order - b.order);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">School year {data.schoolYear.name}</p>
          <h2 className="mt-1 text-xl font-bold text-[#102747]">Subject grades</h2>
        </div>
        <Link href={`/admin/students/${encodeURIComponent(data.student.id)}/report-card`} className="text-sm font-semibold text-[#1d6a45] hover:underline">View full report card</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Subjects" value={String(data.summary.subjectCount)} />
        <Metric label="General average" value={data.generalAverage === null ? "—" : data.generalAverage.toFixed(2)} accent />
        <Metric label="Subjects passed" value={`${data.summary.subjectsPassed} / ${data.summary.subjectCount}`} />
      </div>
      {data.subjects.length ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Subject</th>{terms.map((term) => <th key={term.id} className="px-4 py-3 text-center">Q{term.order}</th>)}<th className="px-4 py-3 text-center">Final</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.subjects.map((subject) => (
                <tr key={`${subject.subjectCode}-${subject.subjectName}`}>
                  <td className="px-4 py-3"><span className="font-semibold text-slate-800">{subject.subjectName}</span><span className="ml-2 text-xs text-slate-500">{subject.subjectCode}</span></td>
                  {terms.map((term) => {
                    const quarter = subject.quarters.find((item) => item.termId === term.id);
                    return <td key={term.id} className="px-4 py-3 text-center text-slate-700">{quarter?.released ? quarter.score ?? "—" : "—"}</td>;
                  })}
                  <td className="px-4 py-3 text-center font-bold text-[#0d412e]">{subject.finalGrade ?? "Pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyReport title="No subject grades yet" description="Grades will appear here once they are recorded and released." />}
    </div>
  );
}

function AttendanceSummary({ data, title }: Readonly<{ data: ReportCard; title: string }>) {
  const attendance = data.attendance.overall;
  const terms = [...data.attendance.terms].sort((a, b) => a.order - b.order);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">School year {data.schoolYear.name}</p>
        <h2 className="mt-1 text-xl font-bold text-[#102747]">{title}</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Attendance rate" value={attendance.rate === null ? "—" : `${attendance.rate}%`} accent />
        <Metric label="Present" value={String(attendance.present)} />
        <Metric label="Absent" value={String(attendance.absent)} />
        <Metric label="Late / excused" value={`${attendance.late} / ${attendance.excused}`} />
      </div>
      {terms.length ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Grading period</th><th className="px-4 py-3">Present</th><th className="px-4 py-3">Absent</th><th className="px-4 py-3">Late</th><th className="px-4 py-3">Rate</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {terms.map((term) => <tr key={term.termId}><td className="px-4 py-3 font-semibold text-slate-800">Quarter {term.order}</td><td className="px-4 py-3">{term.present}</td><td className="px-4 py-3">{term.absent}</td><td className="px-4 py-3">{term.late}</td><td className="px-4 py-3 font-semibold text-[#0d412e]">{term.rate === null ? "—" : `${term.rate}%`}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : <EmptyReport title="No attendance records yet" description="Attendance summaries will appear once records are available for this school year." />}
      <p className="text-xs text-slate-500">Attendance is summarized by grading period in the report card data.</p>
    </div>
  );
}

function InfoCard({ title, icon, children }: Readonly<{ title: string; icon: ReactNode; children: ReactNode }>) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-[#0d412e]"><span className="text-[#1d6a45]">{icon}</span>{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Detail({ label, value, emphasized = false }: Readonly<{ label: string; value?: string | null; emphasized?: boolean }>) {
  return (
    <div className="grid grid-cols-[minmax(120px,0.7fr)_minmax(0,1.3fr)] gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`break-words font-semibold ${emphasized ? "text-[#0d412e]" : "text-slate-800"}`}>{value || "—"}</span>
    </div>
  );
}

function ProfileChip({ icon, label }: Readonly<{ icon: ReactNode; label: string }>) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"><span className="text-[#ffdb74]">{icon}</span>{label}</span>;
}

function ProfileFact({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:px-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-blue-100">{label}</p><p className="mt-0.5 text-sm font-semibold text-white">{value}</p></div>;
}

function SummaryFact({ label, value, highlight = false }: Readonly<{ label: string; value: string; highlight?: boolean }>) {
  return <div className="px-5 py-4 sm:px-6"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 font-bold ${highlight ? "text-lg text-[#0d412e]" : "text-sm text-slate-800"}`}>{value}</p></div>;
}

function ActionButton({ children, onClick }: Readonly<{ children: ReactNode; onClick: () => void }>) {
  return <button type="button" onClick={onClick} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0d412e] px-4 text-sm font-semibold text-white transition hover:bg-[#135b3b]">{children}<span aria-hidden="true">→</span></button>;
}

function Metric({ label, value, accent = false }: Readonly<{ label: string; value: string; accent?: boolean }>) {
  return <div className={`rounded-xl border p-4 ${accent ? "border-[#e8d49b] bg-[#fffaf0]" : "border-slate-200 bg-slate-50"}`}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${accent ? "text-[#9a6e00]" : "text-[#0d412e]"}`}>{value}</p></div>;
}

function EmptyReport({ title, description }: Readonly<{ title: string; description: string }>) {
  return <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center"><h3 className="font-semibold text-slate-800">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></div>;
}

function UnavailablePanel({ icon, title, description }: Readonly<{ icon: ReactNode; title: string; description: string }>) {
  return <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#edf7ef] text-[#1d6a45]">{icon}</div>
    <h2 className="mt-4 text-lg font-bold text-[#102747]">{title}</h2>
    <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
  </div>;
}

function StudentDetailSkeleton() {
  return (
    <div className="mx-auto max-w-[1500px] animate-pulse space-y-5" aria-label="Loading student details">
      <div className="h-5 w-40 rounded bg-slate-200" />
      <div className="h-24 rounded-2xl bg-slate-200" />
      <div className="h-60 rounded-2xl bg-slate-200" />
      <div className="h-14 rounded-t-2xl bg-slate-100" />
      <div className="grid gap-5 md:grid-cols-2"><div className="h-56 rounded-2xl bg-slate-200" /><div className="h-56 rounded-2xl bg-slate-200" /></div>
    </div>
  );
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
}

function calculateAge(birthDate: string | null): string {
  if (!birthDate) return "—";
  const date = new Date(`${birthDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  if (now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())) age -= 1;
  return age >= 0 ? `${age} years` : "—";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
