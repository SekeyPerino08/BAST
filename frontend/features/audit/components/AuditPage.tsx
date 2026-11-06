"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, ClipboardCopy, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { useUrlState } from "../../../hooks/useUrlState";
import { addDays, manilaToday } from "../../../lib/dates";
import { DataTablePagination, EmptyState, ErrorState, TableSkeleton } from "../../../components/shared";
import { useAuditFacets, useAuditLogs } from "../hooks";
import type { AuditEntry, AuditParams } from "../types";

const defaults = { page: "1", pageSize: "25" };
const ACTION_LABELS: Record<string, string> = {
  CREATE: "Created a record", UPDATE: "Updated a record", DELETE: "Deleted a record",
  LOGIN: "Signed in", LOGIN_FAILED: "Failed sign-in attempt", LOGIN_BLOCKED: "Blocked sign-in attempt",
  ACCOUNT_LOCKED: "Account locked", ACCOUNT_UNLOCKED: "Account unlocked", LOGOUT: "Signed out",
  LOGOUT_ALL: "Signed out all sessions", PASSWORD_CHANGE: "Changed password", PASSWORD_RESET: "Reset password",
  FORCE_LOGOUT: "Forced sign-out", USER_CREATED: "Created admin account", EMAIL_CHANGE: "Changed email",
  STATUS_CHANGE: "Changed account status", ACCOUNT_CREATED: "Created login account",
  ENROLL: "Enrolled student", BULK_ENROLL: "Enrolled students", TRANSFER: "Transferred student",
  ATTENDANCE_SAVE: "Saved attendance", GRADES_SAVE: "Saved grades", GRADE_CHANGE: "Changed a grade",
  TERM_LOCK: "Locked grading term", TERM_UNLOCK: "Unlocked grading term",
  REPORT_CARD_VIEW: "Viewed report card", REPORT_CARD_BATCH_VIEW: "Viewed report card batch",
  VIEW_STUDENT: "Viewed student record", VIEW_ENROLLMENTS: "Viewed enrollments", SYNC_COMMIT: "Committed data sync",
};

const SECURITY_ACTIONS = new Set([
  "LOGIN_FAILED", "LOGIN_BLOCKED", "ACCOUNT_LOCKED", "ACCOUNT_UNLOCKED", "PASSWORD_RESET",
  "FORCE_LOGOUT", "STATUS_CHANGE", "LOGOUT_ALL", "EMAIL_CHANGE",
]);

function humanize(action: string) {
  return ACTION_LABELS[action] ?? action.toLowerCase().split("_").filter(Boolean).map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

function asParams(values: Record<string, string | undefined>): AuditParams {
  return {
    page: Math.max(1, Number(values.page) || 1),
    pageSize: [10, 25, 50, 100].includes(Number(values.pageSize)) ? Number(values.pageSize) : 25,
    ...(values.action ? { action: values.action } : {}),
    ...(values.entity_type ? { entity_type: values.entity_type } : {}),
    ...(values.actor ? { actor: values.actor } : {}),
    ...(values.student ? { student: values.student } : {}),
    ...(values.from ? { from: values.from } : {}),
    ...(values.to ? { to: values.to } : {}),
  };
}

function formatExactTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function entityHref(entry: AuditEntry): string | null {
  if (!entry.entityId) return null;
  const entity = entry.entityType.toLowerCase();
  if (entity === "student") return `/admin/students/${encodeURIComponent(entry.entityId)}`;
  if (entity === "teacher") return `/admin/teachers/${encodeURIComponent(entry.entityId)}`;
  if (entity === "section") return `/admin/sections/${encodeURIComponent(entry.entityId)}`;
  return null;
}

function renderValue(value: unknown) {
  if (value === undefined || value === null) return "—";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}

function DetailValues({ before, after }: Readonly<{ before: unknown; after: unknown }>) {
  const oldFields = before && typeof before === "object" && !Array.isArray(before) ? before as Record<string, unknown> : {};
  const newFields = after && typeof after === "object" && !Array.isArray(after) ? after as Record<string, unknown> : {};
  const fields = [...new Set([...Object.keys(oldFields), ...Object.keys(newFields)])];
  if (!fields.length) {
    return <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{renderValue(after ?? before)}</p>;
  }
  return <dl className="grid gap-3 sm:grid-cols-2">{fields.map((key) => <div key={key} className="min-w-0">
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key.replaceAll("_", " ")}</dt>
    <dd className="mt-1 grid gap-1 break-words text-sm text-slate-800">
      <span><span className="font-medium text-slate-500">Old: </span><code className="whitespace-pre-wrap">{renderValue(oldFields[key])}</code></span>
      <span><span className="font-medium text-slate-500">New: </span><code className="whitespace-pre-wrap">{renderValue(newFields[key])}</code></span>
    </dd>
  </div>)}</dl>;
}

function ActionText({ entry }: Readonly<{ entry: AuditEntry }>) {
  return <span className="inline-flex flex-wrap items-center gap-2">
    <span className="inline-flex items-center gap-1.5 font-medium text-slate-900"><Activity size={15} aria-hidden="true" />{humanize(entry.action)}</span>
    {SECURITY_ACTIONS.has(entry.action) && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900"><LockKeyhole size={12} aria-hidden="true" />Security</span>}
  </span>;
}

export function AuditPage() {
  const url = useUrlState(defaults);
  const params = asParams(url.values);
  const facets = useAuditFacets();
  const logs = useAuditLogs(params);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const today = manilaToday();

  return <div className="mx-auto max-w-7xl space-y-6">
    <header>
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Administration</p>
      <h1 className="mt-1 text-3xl font-bold text-slate-900">Audit log</h1>
      <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">The audit log is read-only. Entries cannot be edited or deleted.</p>
      <a href={`/api/audit?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])), format: "csv" })}`}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Export CSV</a>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-medium text-slate-700">Action<select value={url.values.action ?? ""} onChange={(event) => url.update({ action: event.target.value || null })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
          <option value="">All actions</option>{(facets.data?.actions ?? []).map((action) => <option key={action} value={action}>{humanize(action)}</option>)}
        </select></label>
        <label className="text-sm font-medium text-slate-700">Entity type<select value={url.values.entity_type ?? ""} onChange={(event) => url.update({ entity_type: event.target.value || null })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
          <option value="">All entities</option>{(facets.data?.entities ?? []).map((entity) => <option key={entity} value={entity}>{entity}</option>)}
        </select></label>
        <label className="text-sm font-medium text-slate-700">Actor<input value={url.values.actor ?? ""} onChange={(event) => url.updateSearch(event.target.value, 400, "actor")} placeholder="Email or user ID" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700">Student ID<input value={url.values.student ?? ""} onChange={(event) => url.updateSearch(event.target.value, 400, "student")} placeholder="Student ID" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700">From<input type="date" value={url.values.from ?? ""} max={url.values.to ?? today} onChange={(event) => url.update({ from: event.target.value || null })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700">To<input type="date" value={url.values.to ?? ""} min={url.values.from} max={today} onChange={(event) => url.update({ to: event.target.value || null })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Quick range:</span>
        <button type="button" onClick={() => url.update({ from: today, to: today })} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Today</button>
        <button type="button" onClick={() => url.update({ from: addDays(today, -6), to: today })} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Last 7 days</button>
        <button type="button" onClick={url.clear} className="ml-auto rounded-md px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">Clear filters</button>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {logs.isError ? <ErrorState title="Could not load audit entries" error={logs.error} retry={() => void logs.refetch()} />
        : logs.isLoading ? <div className="overflow-x-auto"><table className="w-full min-w-[900px]"><TableSkeleton columns={5} /></table></div>
          : !logs.data?.data.length ? <EmptyState title="No audit entries match your filters" description="Try widening the date range or clearing one or more filters." />
            : <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50"><tr>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Time</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Action</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Entity</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Actor</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">IP address</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Details</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.data.data.map((entry) => <AuditRow key={entry.id} entry={entry} expanded={expandedId === entry.id} onToggle={() => setExpandedId((current) => current === entry.id ? null : entry.id)} />)}
                  </tbody>
                </table>
              </div>
              <DataTablePagination page={logs.data.meta.page} pageSize={logs.data.meta.pageSize} total={logs.data.meta.total} totalPages={logs.data.meta.totalPages}
                onPage={(page) => url.update({ page }, false)} onPageSize={(pageSize) => url.update({ pageSize, page: 1 }, false)} />
            </>}
    </section>
  </div>;
}

function AuditRow({ entry, expanded, onToggle }: Readonly<{ entry: AuditEntry; expanded: boolean; onToggle: () => void }>) {
  const href = entityHref(entry);
  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ before: entry.before, after: entry.after }, null, 2));
      toast.success("Audit details copied");
    } catch {
      toast.error("Could not copy audit details");
    }
  }
  return <>
    <tr>
      <td className="whitespace-nowrap px-4 py-4 text-slate-600"><time dateTime={entry.at} title={formatExactTime(entry.at)}>{formatExactTime(entry.at)}</time></td>
      <td className="px-4 py-4"><span title={entry.action}><ActionText entry={entry} /></span></td>
      <td className="px-4 py-4 text-slate-700"><span className="font-medium">{entry.entityType}</span><span className="block max-w-48 truncate font-mono text-xs text-slate-500" title={entry.entityId ?? undefined}>{entry.entityId ?? "—"}</span></td>
      <td className="px-4 py-4">{entry.actor ? <><span className="block text-slate-800">{entry.actor.email}</span><span className="text-xs text-slate-500">{entry.actor.role}</span></> : <span className="text-slate-500">System / unknown</span>}</td>
      <td className="px-4 py-4 text-slate-600">{entry.ip ?? "—"}</td>
      <td className="px-4 py-4"><button type="button" aria-expanded={expanded} onClick={onToggle} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">{expanded ? "Hide details" : "Details"}</button></td>
    </tr>
    {expanded && <tr><td colSpan={6} className="bg-slate-50 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-semibold text-slate-900">Audit entry details</h3>
          <p className="mt-1 text-xs text-slate-600">Entity ID: <code className="break-all">{entry.entityId ?? "—"}</code></p>
          <p className="mt-1 text-xs text-slate-600">IP address: {entry.ip ?? "—"} · <time dateTime={entry.at}>{formatExactTime(entry.at)}</time></p>
        </div>
        <button type="button" onClick={() => void copyDetails()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"><ClipboardCopy size={14} />Copy JSON</button>
      </div>
      {href && <Link href={href} className="mt-3 inline-block text-sm font-semibold text-indigo-700 hover:underline">Open {entry.entityType.toLowerCase()} page</Link>}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4"><DetailValues before={entry.before} after={entry.after} /></div>
    </td></tr>}
  </>;
}
