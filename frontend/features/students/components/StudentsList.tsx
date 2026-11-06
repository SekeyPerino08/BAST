"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CirclePlus,
  Ellipsis,
  Eye,
  Pencil,
  Search,
  UserRoundPlus,
  UserRoundX,
  Download,
  Columns3,
} from "lucide-react";
import { RoleGuard } from "../../../components/RoleGuard";
import { useUrlState } from "../../../hooks/useUrlState";
import { DataTablePagination, EmptyState, ErrorState, SortableHeader, TableSkeleton } from "../../../components/shared";
import { useStudents } from "../hooks";
import type { Student, StudentListParams, StudentStatus } from "../../../types/student";
import { ChangeStatusDialog } from "./ChangeStatusDialog";
import { CreateAccountDialog as StudentCreateAccountDialog } from "./CreateAccountDialog";
import { StudentFormDialog } from "./StudentFormDialog";
import { StudentStatusBadge } from "./StudentStatusBadge";
import { ReportExportLink } from "../../reports/components/ReportExportLink";
import { PageHeader } from "../../../components/ui";
import { fetchStudents } from "../api";
import { toast } from "sonner";

const urlDefaults = { page: "1", pageSize: "10", sortBy: "lastName", order: "asc" };

type SortBy = StudentListParams["sortBy"];
const statusOptions: { value: StudentStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "GRADUATED", label: "Graduated" },
  { value: "TRANSFERRED", label: "Transferred" },
  { value: "DROPPED", label: "Dropped" },
];

export function StudentsList() {
  const [dialog, setDialog] = useState<"create" | "edit" | "status" | "account" | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    studentNo: true, name: true, sex: true, section: true, guardian: true, status: true, createdAt: true,
  });
  const urlState = useUrlState(urlDefaults);
  const { values, update: updateQuery, updateSearch, clear: clearUrl } = urlState;

  const params = useMemo<StudentListParams>(() => ({
    page: numberParam(values.page ?? null, 1),
    pageSize: numberParam(values.pageSize ?? null, 10),
    search: values.search || undefined,
    status: isStudentStatus(values.status ?? null) ? values.status as StudentStatus : undefined,
    gradeLevel: values.gradeLevel ? numberParam(values.gradeLevel, 7) : undefined,
    sortBy: isSortBy(values.sortBy ?? null) ? values.sortBy as SortBy : "lastName",
    order: values.order === "desc" ? "desc" : "asc",
  }), [values]);

  const query = useStudents(params);
  const response = query.data;
  const page = params.page;
  const pageSize = params.pageSize;
  const activeFilters = Boolean(params.search || params.status || params.gradeLevel);

  function clearFilters() {
    clearUrl();
  }

  function setStudentDialog(kind: "edit" | "status" | "account", student: Student) {
    setSelected(student);
    setDialog(kind);
    setOpenMenu(null);
  }

  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <div className="mx-auto max-w-[1500px]">
        <PageHeader eyebrow="Administration" title="Students" description="Manage student records, enrollment, and login access." actions={<>
            <ReportExportLink report="students-masterlist" filters={{
              ...(params.gradeLevel ? { gradeLevel: String(params.gradeLevel) } : {}),
              ...(params.status ? { status: params.status } : {}),
            }} locked={["gradeLevel", "status"]} label="Export" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" />
            <button type="button" onClick={exportVisibleCsv} disabled={!response?.data.length} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50">
              <Download size={17} aria-hidden="true" /> Export view
            </button>
            <div className="relative">
              <button type="button" aria-expanded={columnsOpen} onClick={() => setColumnsOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
                <Columns3 size={17} aria-hidden="true" /> Columns
              </button>
              {columnsOpen && <fieldset className="absolute right-0 z-30 mt-2 w-52 space-y-2 rounded-xl border border-slate-300 bg-white p-3 shadow-xl">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Visible columns</legend>
                {[
                  ["studentNo", "Student number"], ["name", "Name"], ["sex", "Sex"], ["section", "Grade & section"],
                  ["guardian", "Guardian contact"], ["status", "Status"], ["createdAt", "Created date"],
                ].map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" checked={visibleColumns[key]} onChange={(event) => setVisibleColumns((current) => ({ ...current, [key]: event.target.checked }))} />
                  {label}
                </label>)}
              </fieldset>}
            </div>
            <Link href="/admin/imports?type=students" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              Import CSV
            </Link>
            <button type="button" onClick={() => { setSelected(null); setDialog("create"); }} className="inline-flex items-center gap-2 rounded-xl bg-[#17365d] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#214978] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285487]">
              <CirclePlus size={18} aria-hidden="true" /> Add student
            </button>
          </>} />

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_200px_180px_auto]">
            <label className="relative block">
              <span className="sr-only">Search students</span>
              <Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input key={values.search ?? ""} defaultValue={values.search ?? ""} onChange={(event) => updateSearch(event.target.value)} placeholder="Search name or student number" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#285487] focus:ring-2 focus:ring-[#285487]/10" />
            </label>
            <label>
              <span className="sr-only">Filter by status</span>
              <select value={params.status ?? ""} onChange={(event) => updateQuery({ status: event.target.value || null })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#285487]">
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by grade level</span>
              <select value={params.gradeLevel ?? ""} onChange={(event) => updateQuery({ gradeLevel: event.target.value || null })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#285487]">
                <option value="">All grades</option>
                {[7, 8, 9, 10, 11, 12].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}
              </select>
            </label>
            <button type="button" onClick={clearFilters} disabled={!activeFilters} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
              Clear filters
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {query.isError ? (
            <ErrorState title="Could not load students" error={query.error} retry={() => void query.refetch()} />
          ) : !query.isLoading && !response?.data.length ? (
            <EmptyState title="No students match your filters" description="Try changing the search or filter options."
              action={activeFilters ? <button type="button" onClick={clearFilters} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Clear filters</button> : undefined} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {visibleColumns.studentNo && <SortableHeader label="Student No" sortKey="studentNo" current={params.sortBy} order={params.order} onSort={sort} />}
                      {visibleColumns.name && <SortableHeader label="Name" sortKey="lastName" current={params.sortBy} order={params.order} onSort={sort} />}
                      {visibleColumns.sex && <th scope="col" className="px-4 py-3 font-semibold">Sex</th>}
                      {visibleColumns.section && <th scope="col" className="px-4 py-3 font-semibold">Grade &amp; Section</th>}
                      {visibleColumns.guardian && <th scope="col" className="px-4 py-3 font-semibold">Guardian contact</th>}
                      {visibleColumns.status && <th scope="col" className="px-4 py-3 font-semibold">Status</th>}
                      {visibleColumns.createdAt && <SortableHeader label="Created date" sortKey="createdAt" current={params.sortBy} order={params.order} onSort={sort} />}
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  {query.isLoading && !response
                    ? <TableSkeleton columns={8} rows={pageSize} />
                    : <tbody className="divide-y divide-slate-100">{response?.data.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800">
                          {visibleColumns.studentNo && <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-700">{item.studentNo}</td>}
                          {visibleColumns.name && <td className="whitespace-nowrap px-4 py-4">
                            <Link href={`/admin/students/${item.id}`} className="font-semibold text-slate-900 hover:text-[#285487] dark:hover:text-blue-200">
                              {item.lastName}, {item.firstName}{item.middleName ? ` ${item.middleName.charAt(0)}.` : ""}
                            </Link>
                          </td>}
                          {visibleColumns.sex && <td className="px-4 py-4 text-slate-600">{item.sex === "MALE" ? "Male" : "Female"}</td>}
                          {visibleColumns.section && <td className="px-4 py-4 text-slate-600">
                            {item.currentEnrollment?.section
                              ? `Grade ${item.currentEnrollment.section.gradeLevel} · ${item.currentEnrollment.section.name}`
                              : "Not enrolled"}
                          </td>}
                          {visibleColumns.guardian && <td className="px-4 py-4 text-slate-600">{item.guardianContact || "—"}</td>}
                          {visibleColumns.status && <td className="px-4 py-4"><StudentStatusBadge status={item.status} /></td>}
                          {visibleColumns.createdAt && <td className="whitespace-nowrap px-4 py-4 text-slate-500">{formatDate(item.createdAt)}</td>}
                          <td className="relative px-4 py-3 text-right">
                            <button type="button" aria-label={`Actions for ${item.firstName} ${item.lastName}`} aria-expanded={openMenu === item.id} onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                              <Ellipsis size={19} />
                            </button>
                            {openMenu === item.id && (
                              <div role="menu" className="absolute right-8 top-12 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-lg">
                                <Link role="menuitem" href={`/admin/students/${item.id}`} onClick={() => setOpenMenu(null)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Eye size={16} /> View</Link>
                                <button role="menuitem" type="button" onClick={() => setStudentDialog("edit", item)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Pencil size={16} /> Edit</button>
                                <button role="menuitem" type="button" onClick={() => setStudentDialog("status", item)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><UserRoundX size={16} /> Change status</button>
                                <button role="menuitem" type="button" disabled={Boolean(item.userId)} onClick={() => setStudentDialog("account", item)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><UserRoundPlus size={16} /> {item.userId ? "Account exists" : "Create login account"}</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}</tbody>}
                </table>
              </div>
              <DataTablePagination page={page} pageSize={pageSize} total={response?.meta.total ?? 0}
                totalPages={response?.meta.totalPages ?? 0}
                onPage={(next) => updateQuery({ page: next }, false)}
                onPageSize={(size) => updateQuery({ pageSize: size, page: 1 }, false)} />
            </>
          )}
        </section>

        {dialog === "create" && <StudentFormDialog onClose={() => setDialog(null)} />}
        {dialog === "edit" && selected && <StudentFormDialog student={selected} onClose={() => setDialog(null)} />}
        {dialog === "status" && selected && <ChangeStatusDialog studentId={selected.id} currentStatus={selected.status} onClose={() => setDialog(null)} />}
        {dialog === "account" && selected && <StudentCreateAccountDialog studentId={selected.id} onClose={() => setDialog(null)} />}
      </div>
    </RoleGuard>
  );

  function sort(key: SortBy) {
    const nextOrder = params.sortBy === key && params.order === "asc" ? "desc" : "asc";
    updateQuery({ sortBy: key, order: nextOrder }, false);
  }

  async function exportVisibleCsv() {
    try {
    const firstPage = await fetchStudents({ ...params, page: 1, pageSize: 100 });
    const rows = [...firstPage.data];
    for (let pageNumber = 2; pageNumber <= firstPage.meta.totalPages; pageNumber += 1) {
      const nextPage = await fetchStudents({ ...params, page: pageNumber, pageSize: 100 });
      rows.push(...nextPage.data);
    }
    const columns = [
      ["studentNo", "Student No", (item: typeof rows[number]) => item.studentNo],
      ["name", "Name", (item: typeof rows[number]) => `${item.lastName}, ${item.firstName}${item.middleName ? ` ${item.middleName}` : ""}`],
      ["sex", "Sex", (item: typeof rows[number]) => item.sex],
      ["section", "Grade & Section", (item: typeof rows[number]) => item.currentEnrollment?.section ? `Grade ${item.currentEnrollment.section.gradeLevel} · ${item.currentEnrollment.section.name}` : "Not enrolled"],
      ["guardian", "Guardian Contact", (item: typeof rows[number]) => item.guardianContact ?? ""],
      ["status", "Status", (item: typeof rows[number]) => item.status],
      ["createdAt", "Created Date", (item: typeof rows[number]) => item.createdAt],
    ].filter(([key]) => visibleColumns[key as string]);
    const csv = [
      columns.map(([, title]) => csvCell(title)).join(","),
      ...rows.map((item) => columns.map(([, , getValue]) => csvCell((getValue as (record: typeof item) => string)(item))).join(",")),
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "students-filtered-view.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} students`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export the filtered student list");
    }
  }
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function numberParam(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isStudentStatus(value: string | null): value is StudentStatus {
  return ["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED", "DROPPED"].includes(value ?? "");
}

function isSortBy(value: string | null): value is SortBy {
  return ["lastName", "firstName", "studentNo", "createdAt"].includes(value ?? "");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
