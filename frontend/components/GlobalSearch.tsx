"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Dialog } from "./ui";
import { apiFetch } from "../lib/api";
import { useAuth } from "../providers/AuthProvider";
import type { Role } from "../types/auth";

interface SearchStudent {
  id: string;
  studentNo: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  displayName?: string;
  email?: string;
}

interface StudentSearchResponse {
  data: SearchStudent[];
}

const linksByRole: Record<Role, Array<{ label: string; href: string }>> = {
  ADMIN: [
    { label: "Dashboard", href: "/admin" },
    { label: "Students", href: "/admin/students" },
    { label: "Teachers", href: "/admin/teachers" },
    { label: "Sections", href: "/admin/sections" },
    { label: "Enrollment", href: "/admin/enrollment" },
    { label: "Data sync", href: "/admin/sync" },
    { label: "Audit log", href: "/admin/audit-logs" },
    { label: "Reports", href: "/admin/reports" },
    { label: "Profile", href: "/profile" },
  ],
  TEACHER: [
    { label: "Dashboard", href: "/teacher" },
    { label: "My classes", href: "/teacher/classes" },
    { label: "Attendance", href: "/teacher/attendance" },
    { label: "Grades", href: "/teacher/grades" },
    { label: "Reports", href: "/teacher/reports" },
    { label: "Profile", href: "/profile" },
  ],
  STUDENT: [
    { label: "Dashboard", href: "/student" },
    { label: "My subjects", href: "/student/subjects" },
    { label: "My grades", href: "/student/grades" },
    { label: "My attendance", href: "/student/attendance" },
    { label: "Report card", href: "/student/report-card" },
    { label: "Profile", href: "/profile" },
  ],
  ALUMNI: [
    { label: "Dashboard", href: "/alumni" },
    { label: "My data", href: "/alumni/data" },
    { label: "Courses", href: "/courses" },
    { label: "Profile", href: "/profile" },
  ],
};

async function findStudents(role: Role, query: string): Promise<SearchStudent[]> {
  if (role === "ADMIN") {
    const params = new URLSearchParams({ page: "1", pageSize: "10", search: query });
    const userParams = new URLSearchParams({ page: "1", pageSize: "10", role: "STUDENT", search: query });
    const [result, accounts] = await Promise.all([
      apiFetch<StudentSearchResponse>(`/api/students?${params}`),
      apiFetch<{ data: Array<{ email: string; person: { type: string; id: string; number: string; name: string } | null }> }>(
        `/api/users?${userParams}`,
      ),
    ]);
    const students = new Map(result.data.map((student) => [student.id, student]));
    for (const { person, email } of accounts.data) {
      if (person?.type === "STUDENT") {
        students.set(person.id, {
          id: person.id,
          studentNo: person.number,
          displayName: person.name,
          email,
        });
      }
    }
    return [...students.values()].slice(0, 10);
  }
  if (role === "TEACHER") {
    const classes = await apiFetch<{
      advisedSection: { id: string } | null;
    }>("/api/me/classes");
    if (!classes.advisedSection) return [];
    const reportCards = await apiFetch<Array<{ student: SearchStudent }>>(
      `/api/sections/${encodeURIComponent(classes.advisedSection.id)}/report-cards`,
    );
    const normalized = query.toLowerCase();
    return reportCards.map(({ student }) => student).filter((student) =>
      `${student.studentNo} ${student.firstName} ${student.middleName ?? ""} ${student.lastName}`
        .toLowerCase()
        .includes(normalized),
    ).slice(0, 10);
  }
  return [];
}

export function GlobalSearch() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = search.trim();
  const students = useQuery({
    queryKey: ["global-student-search", user?.role, query],
    queryFn: () => findStudents(user!.role, query),
    enabled: open && Boolean(user) && query.length >= 2 && (user?.role === "ADMIN" || user?.role === "TEACHER"),
    staleTime: 30_000,
  });
  const quickLinks = useMemo(() => user ? linksByRole[user.role] : [], [user]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function close() {
    setOpen(false);
    setSearch("");
  }

  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Search (Control or Command K)"
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700"
    >
      <Search size={16} aria-hidden="true" />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-600 sm:inline-flex">Ctrl/⌘ K</kbd>
    </button>
    {open && <Dialog title="Search CampusHub" description="Find a student you are allowed to view, or jump to a page." onClose={close} size="max-w-2xl">
      <label className="relative block">
        <Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search students by name, ID, or email"
          placeholder="Search by student name or ID"
          className="min-h-12 w-full rounded-lg border border-slate-400 bg-white py-3 pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700"
        />
      </label>
      <div className="mt-4 max-h-[55vh] space-y-4 overflow-y-auto">
        {query.length >= 2 && (user?.role === "ADMIN" || user?.role === "TEACHER") && (
          <section aria-label="Student search results">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Students</h3>
            {students.isError
              ? <div role="alert" className="flex items-center justify-between gap-3 text-sm text-rose-800">
                <span>Could not search students.</span>
                <button type="button" onClick={() => void students.refetch()} className="rounded px-2 py-1 font-semibold underline underline-offset-2">Retry</button>
              </div>
              : students.isLoading
                ? <p className="text-sm text-slate-700" aria-live="polite">Searching…</p>
                : students.data?.length
                  ? <ul className="space-y-1">{students.data.map((student) => {
                    const href = user.role === "ADMIN"
                      ? `/admin/students/${encodeURIComponent(student.id)}`
                      : `/teacher/advisory/report-cards/${encodeURIComponent(student.id)}`;
                    return <li key={student.id}>
                      <Link href={href} onClick={close} className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900">{student.displayName ?? `${student.lastName}, ${student.firstName}${student.middleName ? ` ${student.middleName}` : ""}`}</span>
                          {student.email && <span className="block truncate text-xs text-slate-600">{student.email}</span>}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-slate-700">{student.studentNo}</span>
                      </Link>
                    </li>;
                  })}</ul>
                  : <p className="text-sm text-slate-700">No visible students matched that search.</p>}
          </section>
        )}
        {query.length < 2 && <p className="text-sm text-slate-600">Type at least two characters to search visible student records.</p>}
        <section aria-label="Quick links">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Quick links</h3>
          <ul className="grid gap-1 sm:grid-cols-2">{quickLinks.map((link) => <li key={link.href}>
            <Link href={link.href} onClick={close} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">{link.label}</Link>
          </li>)}</ul>
        </section>
      </div>
    </Dialog>}
  </>;
}
