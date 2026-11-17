"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarDays, FileText, Inbox, NotebookPen, School } from "lucide-react";
import { apiFetch } from "../../lib/api";

type PortalType =
  | "assignments"
  | "announcements"
  | "schedule"
  | "materials"
  | "documents"
  | "notifications"
  | "history";

interface StudentPortalPageProps {
  title: string;
  description: string;
  endpoint: string;
  type: PortalType;
  emptyText: string;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function fullname(person: Record<string, unknown> | null | undefined) {
  if (!person) return "Unknown";
  const parts = [person.firstName, person.middleName, person.lastName].filter(Boolean) as string[];
  return parts.length ? parts.join(" ") : "Unknown";
}

export function StudentPortalPage({ title, description, endpoint, type, emptyText }: StudentPortalPageProps) {
  const query = useQuery({
    queryKey: ["student-portal", endpoint],
    queryFn: async () => {
      const response = await apiFetch<{ data: Array<Record<string, unknown>> }>(`/api${endpoint}`);
      return response.data ?? [];
    },
    staleTime: 30_000,
  });

  const items = (query.data ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Student portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
      </header>

      {query.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
          <div className="flex items-center gap-2 font-semibold"><AlertCircle size={16} />Unable to load this information</div>
          <p className="mt-2">{query.error instanceof Error ? query.error.message : "Please try again."}</p>
        </div>
      ) : query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : !items.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto inline-flex rounded-full bg-slate-100 p-3 dark:bg-slate-800"><School size={22} className="text-slate-500" /></div>
          <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No records found</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{emptyText}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const id = String(item.id ?? Math.random());
            const subject = asRecord(item.subject);
            const teacher = asRecord(item.teacher);
            const section = asRecord(item.section);
            const term = asRecord(item.term);
            if (type === "assignments") {
              return (
                <article key={id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{String(item.status ?? "OPEN")}</span>
                    <NotebookPen size={18} className="text-indigo-600" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">{String(item.title ?? "Untitled assignment")}</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{String(subject.code ?? "SUBJECT")} · {String(subject.name ?? "Subject")}</p>
                  <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <p className="flex items-center gap-2"><CalendarDays size={15} /> Due: {formatDate(String(item.dueAt ?? ""))}</p>
                    <p className="flex items-center gap-2"><FileText size={15} /> Teacher: {fullname(teacher)}</p>
                  </div>
                </article>
              );
            }

            if (type === "announcements") {
              return (
                <article key={id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-200">{String(item.category ?? "ANNOUNCEMENT")}</span>
                    <School size={18} className="text-amber-600" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">{String(item.title ?? "Announcement")}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{String(item.body ?? "No details provided.")}</p>
                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Published {formatDate(String(item.publishedAt ?? ""))}</p>
                </article>
              );
            }

            if (type === "schedule") {
              return (
                <article key={id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">{String(item.dayOfWeek ?? "Class")}</span>
                    <CalendarDays size={18} className="text-emerald-600" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">{String(subject.name ?? "Subject")}</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{String(subject.code ?? "SUBJ")} · {String(section.name ?? "Section")}</p>
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{String(item.startTime ?? "--:--")} - {String(item.endTime ?? "--:--")}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Room: {String(item.room ?? "To be assigned")}</p>
                </article>
              );
            }

            if (type === "materials") {
              return (
                <article key={id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-200">{String(item.fileType ?? "FILE")}</span>
                    <FileText size={18} className="text-sky-600" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">{String(item.title ?? "Learning material")}</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{String(item.fileName ?? "Attachment")}</p>
                  <a href={String(item.fileUrl ?? "#")} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">Open file</a>
                </article>
              );
            }

            if (type === "documents") {
              return (
                <article key={id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-200">{String(item.status ?? "PENDING")}</span>
                    <FileText size={18} className="text-violet-600" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">{String(item.documentType ?? "Document request")}</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{String(item.reason ?? "No reason given")}</p>
                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Requested {formatDate(String(item.requestedAt ?? ""))}</p>
                </article>
              );
            }

            if (type === "notifications") {
              return (
                <article key={id} className={`rounded-2xl border p-5 shadow-sm ${item.isRead ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" : "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">{item.isRead ? "Read" : "New"}</span>
                    <Inbox size={18} className="text-indigo-600" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">{String(item.title ?? "Notification")}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{String(item.message ?? "No message.")}</p>
                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{formatDate(String(item.createdAt ?? ""))}</p>
                </article>
              );
            }

            return (
              <article key={id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{String(term.name ?? "Academic term")}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Average: {item.average !== null && item.average !== undefined ? `${Number(item.average).toFixed(2)}%` : "Not available"}</p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{Array.isArray(item.courses) ? `${item.courses.length} courses` : "Academic record"}</p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
