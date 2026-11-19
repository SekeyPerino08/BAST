"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search } from "lucide-react";
import { DataTablePagination, EmptyState, ErrorState } from "../../../components/shared";
import { apiFetch } from "../../../lib/api";
import { useAuth } from "../../../providers/AuthProvider";

type LoanStatus = "ALL" | "BORROWED" | "OVERDUE" | "RETURNED";
type LibraryLoan = {
  id: string;
  bookTitle: string;
  loanedOn: string;
  dueOn: string;
  returnedOn: string | null;
  status: "Borrowed" | "Overdue" | "Returned";
  student: { id: string; studentNo: string; firstName: string; middleName: string | null; lastName: string };
};
type LibraryLoansResponse = {
  data: LibraryLoan[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  summary: { borrowed: number; overdue: number; returned: number };
};

function date(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export function LibraryLoanList() {
  const { user } = useAuth();
  const [status, setStatus] = useState<LoanStatus>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const loans = useQuery({
    queryKey: ["library-loans", { status, search, page, pageSize }],
    queryFn: () => {
      const query = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
      if (search.trim()) query.set("search", search.trim());
      return apiFetch<LibraryLoansResponse>(`/api/students/library-loans?${query}`);
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#1d6a45]">{user?.role === "ADMIN" ? "Student services" : "Advisory"}</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Library loans</h1>
        <p className="mt-1 text-sm text-slate-500">A read-only view of loans synced from the library system.</p>
      </header>
      {loans.isError ? <ErrorState title="Could not load library loans" error={loans.error} retry={() => void loans.refetch()} />
        : loans.isLoading ? <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}</div>
          : loans.data && (
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard label="Borrowed" value={loans.data.summary.borrowed} />
              <SummaryCard label="Overdue" value={loans.data.summary.overdue} danger />
              <SummaryCard label="Returned" value={loans.data.summary.returned} />
            </div>
          )}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-4">
          <label className="block text-sm font-medium text-slate-700">Status
            <select value={status} onChange={(event) => { setStatus(event.target.value as LoanStatus); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="ALL">All loans</option><option value="BORROWED">Borrowed</option><option value="OVERDUE">Overdue</option><option value="RETURNED">Returned</option>
            </select>
          </label>
          <label className="relative block w-full sm:max-w-sm"><span className="sr-only">Search loans or students</span><Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search title, name, or student number" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm" /></label>
        </div>
        {loans.isError ? <ErrorState title="Could not load library loans" error={loans.error} retry={() => void loans.refetch()} />
          : loans.isLoading ? <div className="h-60 animate-pulse bg-slate-50" />
            : loans.data?.data.length ? <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Book</th><th className="px-4 py-3">Loaned</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Returned</th><th className="px-4 py-3">Status</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{loans.data.data.map((loan) => <tr key={loan.id}>
                    <td className="px-4 py-3"><Link href={user?.role === "ADMIN" ? `/admin/students/${encodeURIComponent(loan.student.id)}` : `/teacher/advisory/report-cards/${encodeURIComponent(loan.student.id)}`} className="font-semibold text-[#1d6a45] hover:underline">{loan.student.lastName}, {loan.student.firstName}</Link><span className="block text-xs text-slate-500">{loan.student.studentNo}</span></td>
                    <td className="px-4 py-3 font-medium text-slate-800">{loan.bookTitle}</td>
                    <td className="px-4 py-3">{date(loan.loanedOn)}</td><td className="px-4 py-3">{date(loan.dueOn)}</td><td className="px-4 py-3">{loan.returnedOn ? date(loan.returnedOn) : "—"}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${loan.status === "Overdue" ? "bg-rose-50 text-rose-700" : loan.status === "Returned" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{loan.status}</span></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <DataTablePagination page={loans.data.meta.page} pageSize={loans.data.meta.pageSize} total={loans.data.meta.total} totalPages={loans.data.meta.totalPages} onPage={setPage} onPageSize={(size) => { setPage(1); setPageSize(size); }} />
            </> : <EmptyState title="No loans found" description="No library loans match these filters." />}
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
