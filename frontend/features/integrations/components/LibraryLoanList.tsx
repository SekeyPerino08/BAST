"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, Search } from "lucide-react";
import { DataTablePagination, EmptyState, ErrorState } from "../../../components/shared";
import { apiFetch, downloadApiFile } from "../../../lib/api";
import { useAuth } from "../../../providers/AuthProvider";

type LoanStatus = "ALL" | "BORROWED" | "OVERDUE" | "RETURNED";
type DaysOverdueRange = "ANY" | "1_7" | "8_30" | "31_PLUS";
type LibrarySection = {
  id: string;
  name: string;
  gradeLevel: number;
  strand: string | null;
};
type LibraryLoan = {
  id: string;
  bookTitle: string;
  loanedOn: string;
  dueOn: string;
  returnedOn: string | null;
  status: "Borrowed" | "Overdue" | "Returned";
  daysOverdue: number;
  student: {
    id: string;
    studentNo: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    section: LibrarySection | null;
    adviser: { firstName: string; middleName: string | null; lastName: string } | null;
  };
};
type LibraryLoansResponse = {
  data: LibraryLoan[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  summary: { borrowed: number; overdue: number; overdueStudents: number; overdueItems: number; returned: number };
  filters: { strands: string[]; gradeLevels: number[]; sections: LibrarySection[] };
};

function date(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function strandLabel(value: string | null | undefined) {
  return value?.replace("_", "-") ?? "—";
}

function personName(person: { firstName: string; middleName?: string | null; lastName: string }) {
  return [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");
}

function libraryLoanQuery(filters: {
  status: LoanStatus;
  search: string;
  page: number;
  pageSize: number;
  strand: string;
  gradeLevel: string;
  sectionId: string;
  daysOverdue: DaysOverdueRange;
  sortBy: "DAYS_OVERDUE_ASC" | "DAYS_OVERDUE_DESC";
}) {
  const query = new URLSearchParams({
    status: filters.status,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    daysOverdue: filters.daysOverdue,
    sortBy: filters.sortBy,
  });
  if (filters.search.trim()) query.set("search", filters.search.trim());
  if (filters.strand) query.set("strand", filters.strand);
  if (filters.gradeLevel) query.set("gradeLevel", filters.gradeLevel);
  if (filters.sectionId) query.set("sectionId", filters.sectionId);
  return query;
}

export function LibraryLoanList() {
  const { user } = useAuth();
  const [status, setStatus] = useState<LoanStatus>("OVERDUE");
  const [search, setSearch] = useState("");
  const [strand, setStrand] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [daysOverdue, setDaysOverdue] = useState<DaysOverdueRange>("ANY");
  const [sortBy, setSortBy] = useState<"DAYS_OVERDUE_ASC" | "DAYS_OVERDUE_DESC">("DAYS_OVERDUE_DESC");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const filters = { status, search, page, pageSize, strand, gradeLevel, sectionId, daysOverdue, sortBy };
  const loans = useQuery({
    queryKey: ["library-loans", filters],
    queryFn: () => apiFetch<LibraryLoansResponse>(`/api/students/library-loans?${libraryLoanQuery(filters)}`),
  });

  async function exportCsv() {
    setExportError(null);
    setExporting(true);
    try {
      const query = libraryLoanQuery({ ...filters, page: 1, pageSize: 100 });
      await downloadApiFile(`/api/students/library-loans/export.csv?${query}`, "library-overdue.csv");
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not export library overdue items.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#1d6a45]">{user?.role === "ADMIN" ? "Student services" : "Advisory"}</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Library Overdue</h1>
        <p className="mt-1 text-sm text-slate-500">Overdue means the due date was before today in Asia/Manila and the item has not been returned. Fine amounts are not tracked in the library data.</p>
      </header>
      {loans.isError ? <ErrorState title="Could not load library overdue items" error={loans.error} retry={() => void loans.refetch()} />
        : loans.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}</div>
          : loans.data && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Overdue students" value={loans.data.summary.overdueStudents} danger />
              <SummaryCard label="Overdue items" value={loans.data.summary.overdueItems} danger />
              <SummaryCard label="Borrowed (not overdue)" value={loans.data.summary.borrowed} />
              <SummaryCard label="Returned" value={loans.data.summary.returned} />
            </div>
          )}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-4">
          <label className="block text-sm font-medium text-slate-700">Status
            <select value={status} onChange={(event) => { setStatus(event.target.value as LoanStatus); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="OVERDUE">Overdue items</option><option value="ALL">All loans</option><option value="BORROWED">Borrowed (not overdue)</option><option value="RETURNED">Returned</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Strand
            <select value={strand} onChange={(event) => { setStrand(event.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="">All strands</option>
              {loans.data?.filters.strands.map((value) => <option key={value} value={value}>{strandLabel(value)}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Grade level
            <select value={gradeLevel} onChange={(event) => { setGradeLevel(event.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="">All grades</option>
              {loans.data?.filters.gradeLevels.map((value) => <option key={value} value={value}>Grade {value}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Section
            <select value={sectionId} onChange={(event) => { setSectionId(event.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="">All sections</option>
              {loans.data?.filters.sections.map((section) => <option key={section.id} value={section.id}>Grade {section.gradeLevel} · {strandLabel(section.strand)} · {section.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Days overdue
            <select value={daysOverdue} onChange={(event) => { setDaysOverdue(event.target.value as DaysOverdueRange); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="ANY">Any</option><option value="1_7">1–7 days</option><option value="8_30">8–30 days</option><option value="31_PLUS">31+ days</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Sort by
            <select value={sortBy} onChange={(event) => { setSortBy(event.target.value as typeof sortBy); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="DAYS_OVERDUE_DESC">Most overdue first</option><option value="DAYS_OVERDUE_ASC">Least overdue first</option>
            </select>
          </label>
          <label className="relative block w-full sm:max-w-sm"><span className="sr-only">Search students or books</span><Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search student name or ID" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm" /></label>
          <button type="button" onClick={() => void exportCsv()} disabled={exporting || loans.isLoading} className="inline-flex items-center gap-2 rounded-lg bg-[#1d6a45] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155237] disabled:cursor-not-allowed disabled:opacity-60">
            <Download size={16} aria-hidden="true" />{exporting ? "Preparing CSV…" : "Export CSV"}
          </button>
          {exportError && <p className="w-full text-sm text-rose-700" role="alert">{exportError}</p>}
        </div>
        {loans.isError ? <ErrorState title="Could not load library overdue items" error={loans.error} retry={() => void loans.refetch()} />
          : loans.isLoading ? <div className="h-60 animate-pulse bg-slate-50" />
            : loans.data?.data.length ? <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1450px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Grade</th><th className="px-4 py-3">Strand</th><th className="px-4 py-3">Section</th><th className="px-4 py-3">Adviser</th><th className="px-4 py-3">Book</th><th className="px-4 py-3">Borrowed</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Days overdue</th><th className="px-4 py-3">Returned</th><th className="px-4 py-3">Status</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{loans.data.data.map((loan) => <tr key={loan.id}>
                    <td className="px-4 py-3"><Link href={user?.role === "ADMIN" ? `/admin/students/${encodeURIComponent(loan.student.studentNo)}` : `/teacher/advisory/report-cards/${encodeURIComponent(loan.student.id)}`} className="font-semibold text-[#1d6a45] hover:underline">{loan.student.lastName}, {loan.student.firstName}</Link><span className="block text-xs text-slate-500">{loan.student.studentNo}</span></td>
                    <td className="px-4 py-3">{loan.student.section ? `Grade ${loan.student.section.gradeLevel}` : "—"}</td>
                    <td className="px-4 py-3">{strandLabel(loan.student.section?.strand)}</td>
                    <td className="px-4 py-3">{loan.student.section?.name ?? "—"}</td>
                    <td className="px-4 py-3">{loan.student.adviser ? personName(loan.student.adviser) : "—"}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{loan.bookTitle}</td>
                    <td className="px-4 py-3">{date(loan.loanedOn)}</td>
                    <td className="px-4 py-3">{date(loan.dueOn)}</td>
                    <td className="px-4 py-3 font-semibold">{loan.daysOverdue || "—"}</td>
                    <td className="px-4 py-3">{loan.returnedOn ? date(loan.returnedOn) : "—"}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${loan.status === "Overdue" ? "bg-rose-50 text-rose-700" : loan.status === "Returned" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{loan.status}</span></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <DataTablePagination page={loans.data.meta.page} pageSize={loans.data.meta.pageSize} total={loans.data.meta.total} totalPages={loans.data.meta.totalPages} onPage={setPage} onPageSize={(size) => { setPage(1); setPageSize(size); }} />
            </> : <EmptyState title={status === "OVERDUE" ? "No overdue library items" : "No loans found"} description={status === "OVERDUE" ? "No active overdue items match these filters." : "No library loans match these filters."} />}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, danger = false }: Readonly<{ label: string; value: number; danger?: boolean }>) {
  return <article className={`rounded-2xl border p-5 shadow-sm ${danger ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
    <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-600">{label}</p><BookOpen size={18} className={danger ? "text-rose-700" : "text-[#1d6a45]"} /></div>
    <p className={`mt-3 text-2xl font-bold ${danger ? "text-rose-800" : "text-slate-900"}`}>{value.toLocaleString()}</p>
  </article>;
}
