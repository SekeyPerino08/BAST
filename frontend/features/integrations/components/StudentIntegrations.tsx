"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, apiFetch } from "../../../lib/api";
import { EmptyState, ErrorState } from "../../../components/shared";

type LmsData = {
  summary: { logins: number; onTimeSubmissionPercent: number | null; quizAverage: number | null };
  events: Array<{
    id: string; type: string; occurredAt: string; score: string | number | null;
    onTime: boolean | null; course: { code: string; name: string } | null;
  }>;
};
type Loan = { id: string; bookTitle: string; loanedOn: string; dueOn: string; returnedOn: string | null; status: string };
type AlumniRecord = { id: string; kind: string; amount: string | number | null; occurredOn: string; detail: string | null };

export function StudentIntegrations({ studentId, showAlumni = true }: Readonly<{ studentId?: string; showAlumni?: boolean }>) {
  const base = studentId ? `/api/students/${encodeURIComponent(studentId)}` : "/api/me";
  const lms = useQuery({ queryKey: ["integrations", studentId ?? "self", "lms"], queryFn: () => apiFetch<LmsData>(`${base}/lms`) });
  const library = useQuery({ queryKey: ["integrations", studentId ?? "self", "library"], queryFn: () => apiFetch<{ data: Loan[] }>(`${base}/library`) });
  const alumni = useQuery({
    queryKey: ["integrations", studentId ?? "self", "alumni"],
    queryFn: () => apiFetch<{ data: AlumniRecord[] }>(`${base}/alumni`),
    enabled: showAlumni,
  });

  return <section className="space-y-5" aria-label="Integrated student information">
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">LMS activity</h2><p className="mt-1 text-xs text-slate-500">Summary for the last 30 days and latest events.</p></header>
      {lms.isError ? <ErrorState title="Could not load LMS activity" error={lms.error} retry={() => void lms.refetch()} />
        : lms.isLoading ? <LoadingRows />
          : lms.data ? <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-3"><Metric label="Logins" value={String(lms.data.summary.logins)} /><Metric label="On-time submissions" value={percent(lms.data.summary.onTimeSubmissionPercent)} /><Metric label="Quiz average" value={score(lms.data.summary.quizAverage)} /></div>
            {lms.data.events.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Event</th><th className="px-4 py-2">Course</th><th className="px-4 py-2">When</th><th className="px-4 py-2">Result</th></tr></thead><tbody className="divide-y divide-slate-100">{lms.data.events.map((event) => <tr key={event.id}><td className="px-4 py-3">{event.type.toLowerCase()}</td><td className="px-4 py-3">{event.course ? `${event.course.code} · ${event.course.name}` : "—"}</td><td className="px-4 py-3">{new Date(event.occurredAt).toLocaleString()}</td><td className="px-4 py-3">{event.score !== null ? score(Number(event.score)) : event.onTime === null ? "—" : event.onTime ? "On time" : "Late"}</td></tr>)}</tbody></table></div> : <EmptyState title="No LMS events" description="No activity has been received yet." />}
          </div> : null}
    </article>

    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Library loans</h2><p className="mt-1 text-xs text-slate-500">Loan status is calculated from return and due dates.</p></header>
      {library.isError ? <ErrorState title="Could not load library loans" error={library.error} retry={() => void library.refetch()} />
        : library.isLoading ? <LoadingRows />
          : library.data?.data.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Book</th><th className="px-5 py-3">Loaned</th><th className="px-5 py-3">Due</th><th className="px-5 py-3">Returned</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{library.data.data.map((loan) => <tr key={loan.id}><td className="px-5 py-3 font-medium">{loan.bookTitle}</td><td className="px-5 py-3">{formatDate(loan.loanedOn)}</td><td className="px-5 py-3">{formatDate(loan.dueOn)}</td><td className="px-5 py-3">{loan.returnedOn ? formatDate(loan.returnedOn) : "—"}</td><td className="px-5 py-3">{loan.status}</td></tr>)}</tbody></table></div> : <EmptyState title="No library loans" description="No loan history has been received yet." />}
    </article>

    {showAlumni && <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Alumni engagement</h2><p className="mt-1 text-xs text-slate-500">Donations, events, and mentoring activity.</p></header>
      {alumni.isError ? alumni.error instanceof ApiError && alumni.error.status === 404
        ? <p className="px-5 py-6 text-sm text-slate-500">Alumni records are available for graduated students.</p>
        : <ErrorState title="Could not load alumni records" error={alumni.error} retry={() => void alumni.refetch()} />
        : alumni.isLoading ? <LoadingRows />
          : alumni.data?.data.length ? <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Type</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{alumni.data.data.map((record) => <tr key={record.id}><td className="px-5 py-3">{record.kind.toLowerCase()}</td><td className="px-5 py-3">{formatDate(record.occurredOn)}</td><td className="px-5 py-3">{record.amount === null ? "—" : Number(record.amount).toLocaleString()}</td><td className="px-5 py-3">{record.detail || "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="No alumni activity" description="No alumni engagement records have been received." />}
    </article>}
  </section>;
}

function LoadingRows() {
  return <div className="animate-pulse space-y-3 p-5"><div className="h-5 rounded bg-slate-200" /><div className="h-5 rounded bg-slate-100" /></div>;
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>;
}

function percent(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function score(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
