"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "../../components/shared";
import { ApiError, apiFetch } from "../../lib/api";

type AlertStatus = "NOT_STARTED" | "IN_PROGRESS" | "RESOLVED";
type SupportAlert = {
  id: string;
  rule: "LOW_GRADE" | "DECLINING_GRADE" | "ATTENDANCE";
  status: AlertStatus;
  summary: string;
  evidence: unknown;
  conditionActive: boolean;
  followUpNote: string | null;
  updatedAt: string;
  student: { id: string; studentNo: string; firstName: string; lastName: string };
};
type SupportResponse = { schoolYearId: string; data: SupportAlert[] };

const statusNames: Record<AlertStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

const statusStyle: Record<AlertStatus, string> = {
  NOT_STARTED: "bg-rose-50 text-rose-800",
  IN_PROGRESS: "bg-amber-50 text-amber-800",
  RESOLVED: "bg-emerald-50 text-emerald-800",
};

export function SupportAlertsPage() {
  const client = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const alerts = useQuery({
    queryKey: ["support-alerts"],
    queryFn: () => apiFetch<SupportResponse>("/api/support-alerts/refresh", { method: "POST" }),
  });
  const update = useMutation({
    mutationFn: ({ id, status, followUpNote }: { id: string; status: AlertStatus; followUpNote: string }) =>
      apiFetch(`/api/support-alerts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, followUpNote: followUpNote || null }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["support-alerts"] });
      toast.success("Follow-up updated");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not update the alert"),
  });
  const rows = alerts.data?.data ?? [];
  const unresolvedCount = rows.filter((row) => row.status !== "RESOLVED").length;

  return <div className="mx-auto max-w-7xl space-y-6">
    <header>
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Student support</p>
      <h1 className="mt-1 text-3xl font-bold text-slate-900">Early-warning alerts</h1>
      <p className="mt-2 text-sm text-slate-500">Visible to administrators and assigned section advisers only. Alerts are prompts for human review, not diagnoses.</p>
    </header>
    <section className="grid gap-3 sm:grid-cols-3">
      <Metric label="Open follow-ups" value={unresolvedCount} color="amber" />
      <Metric label="Active signals" value={rows.filter((row) => row.conditionActive).length} color="rose" />
      <Metric label="Resolved" value={rows.filter((row) => row.status === "RESOLVED").length} color="green" />
    </section>
    {alerts.isError ? <ErrorState title="Could not load support alerts" error={alerts.error} retry={() => void alerts.refetch()} />
      : alerts.isLoading ? <p role="status" className="rounded-xl border bg-white p-5 text-sm text-slate-500">Checking released grades and the last 30 days of attendance…</p>
        : !rows.length ? <EmptyState title="No support alerts" description="No enrolled advisees currently match the early-warning rules." />
          : <section className="space-y-3">
            {rows.map((alert) => <article key={alert.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ruleName(alert.rule)}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{alert.student.lastName}, {alert.student.firstName}</h2>
                  <p className="text-sm text-slate-500">Student No. {alert.student.studentNo}</p>
                  <p className="mt-2 text-sm text-slate-700">{alert.summary}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[alert.status]}`}>{statusNames[alert.status]}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${alert.conditionActive ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-600"}`}>{alert.conditionActive ? "Signal active" : "Signal no longer active"}</span>
                </div>
              </div>
              <details className="mt-3 text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold">Review signal evidence</summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3">{JSON.stringify(alert.evidence, null, 2)}</pre>
              </details>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <label className="text-xs font-semibold text-slate-600">Follow-up note
                  <textarea rows={2} maxLength={1000} value={notes[alert.id] ?? alert.followUpNote ?? ""} onChange={(event) => setNotes({ ...notes, [alert.id]: event.target.value })} placeholder="Record the next step or outcome" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  {(["NOT_STARTED", "IN_PROGRESS", "RESOLVED"] as const).map((status) => <button key={status} type="button" disabled={update.isPending} onClick={() => update.mutate({ id: alert.id, status, followUpNote: notes[alert.id] ?? alert.followUpNote ?? "" })} className={`rounded-lg px-3 py-2 text-xs font-semibold ${alert.status === status ? statusStyle[status] : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}>{statusNames[status]}</button>)}
                </div>
              </div>
            </article>)}
          </section>}
    <p className="text-xs text-slate-500">Rules: latest released term average below 75; a drop of 5 or more points from the prior released term; or attendance below 80% / at least 3 absent class records in the last 30 days. Excused attendance is excluded. Confirm context with the student before acting.</p>
  </div>;
}

function Metric({ label, value, color }: Readonly<{ label: string; value: number; color: "amber" | "rose" | "green" }>) {
  const colors = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return <div className={`rounded-xl border p-4 ${colors[color]}`}><p className="text-xs font-semibold uppercase">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>;
}

function ruleName(rule: SupportAlert["rule"]) {
  return {
    LOW_GRADE: "Below passing",
    DECLINING_GRADE: "Declining grades",
    ATTENDANCE: "Attendance",
  }[rule];
}
