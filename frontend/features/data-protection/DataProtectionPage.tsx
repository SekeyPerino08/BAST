"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "../../components/shared";
import { ApiError, apiFetch } from "../../lib/api";
import { addDays, manilaToday } from "../../lib/dates";

type ExerciseKind = "BACKUP_VERIFICATION" | "RESTORE_TEST";
type ExerciseResult = "PASSED" | "FAILED";
type Exercise = {
  id: string;
  kind: ExerciseKind;
  result: ExerciseResult;
  testedAt: string;
  notes: string;
  recordedBy: { firstName: string; lastName: string; email: string };
};
type Overview = {
  policies: Array<{ area: string; retention: string }>;
  backupProvider: string;
  exercises: Exercise[];
};

const inputClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function DataProtectionPage() {
  const client = useQueryClient();
  const [form, setForm] = useState<{ kind: ExerciseKind; result: ExerciseResult; testedAt: string; notes: string }>({
    kind: "BACKUP_VERIFICATION",
    result: "PASSED",
    testedAt: manilaToday(),
    notes: "",
  });
  const overview = useQuery({
    queryKey: ["data-protection"],
    queryFn: () => apiFetch<{ data: Overview }>("/api/data-protection"),
  });
  const record = useMutation({
    mutationFn: () => apiFetch("/api/data-protection/recovery-exercises", {
      method: "POST",
      body: JSON.stringify(form),
    }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["data-protection"] });
      setForm({ ...form, notes: "" });
      toast.success("Recovery exercise recorded");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not record the exercise"),
  });
  const data = overview.data?.data;
  const lastBackupCheck = data?.exercises.find((exercise) => exercise.kind === "BACKUP_VERIFICATION");
  const lastRestoreTest = data?.exercises.find((exercise) => exercise.kind === "RESTORE_TEST");

  return <div className="mx-auto max-w-6xl space-y-6">
    <header>
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Administration</p>
      <h1 className="mt-1 text-3xl font-bold text-slate-900">Data protection & recovery</h1>
      <p className="mt-2 text-sm text-slate-500">Review access records, understand retention behavior, and keep a record of recovery exercises.</p>
    </header>
    <section className="grid gap-3 sm:grid-cols-2" aria-label="Recovery check status">
      <RecoveryStatus title="Backup verification" exercise={lastBackupCheck} />
      <RecoveryStatus title="Restore test" exercise={lastRestoreTest} />
    </section>
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <h2 className="font-semibold">Backups and restore testing</h2>
      <p className="mt-1">{data?.backupProvider ?? "Database backups are managed by the configured database provider."} This page records completed checks; it does not run or verify a backup or restore. Run restore tests only against a separate, disposable database and follow the provider&apos;s recovery procedure.</p>
      <p className="mt-2">Recommended practice: verify backup availability regularly and perform a restore exercise at least once per term or after major database changes, following school policy.</p>
      <a href="https://console.neon.tech" target="_blank" rel="noreferrer" className="mt-3 inline-flex font-semibold underline">Open Neon Console</a>
    </section>

    {overview.isError ? <ErrorState title="Could not load data protection overview" error={overview.error} retry={() => void overview.refetch()} />
      : overview.isLoading ? <p role="status" className="rounded-xl border bg-white p-5 text-sm text-slate-500">Loading retention information…</p>
        : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Current retention behavior</h2><p className="mt-1 text-xs text-slate-500">These are the application behaviors; coordinate school-approved retention periods with the database provider.</p></div>
          <dl className="divide-y divide-slate-100">{data?.policies.map((policy) => <div key={policy.area} className="grid gap-1 px-5 py-4 sm:grid-cols-[200px_1fr]"><dt className="text-sm font-semibold text-slate-800">{policy.area}</dt><dd className="text-sm text-slate-600">{policy.retention}</dd></div>)}</dl>
        </section>}

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={(event) => { event.preventDefault(); record.mutate(); }}>
        <div><h2 className="font-semibold text-slate-900">Record a completed recovery exercise</h2><p className="mt-1 text-xs text-slate-500">Enter results only after checking the provider console or completing an isolated restore.</p></div>
        <label className="block text-sm font-medium text-slate-700">Check type<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as ExerciseKind })} className={`${inputClass} mt-1 w-full`}><option value="BACKUP_VERIFICATION">Backup availability verification</option><option value="RESTORE_TEST">Restore test</option></select></label>
        <label className="block text-sm font-medium text-slate-700">Result<select value={form.result} onChange={(event) => setForm({ ...form, result: event.target.value as ExerciseResult })} className={`${inputClass} mt-1 w-full`}><option value="PASSED">Passed</option><option value="FAILED">Failed</option></select></label>
        <label className="block text-sm font-medium text-slate-700">Test date<input required type="date" max={manilaToday()} value={form.testedAt} onChange={(event) => setForm({ ...form, testedAt: event.target.value })} className={`${inputClass} mt-1 w-full`} /></label>
        <label className="block text-sm font-medium text-slate-700">Notes<textarea required minLength={10} maxLength={1000} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Record the backup point, isolated target, and outcome; do not include credentials or student data." className={`${inputClass} mt-1 w-full`} /></label>
        <button disabled={record.isPending || overview.isError} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{record.isPending ? "Recording…" : "Record check"}</button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Recent recovery exercises</h2><p className="mt-1 text-xs text-slate-500">Latest 20 administrator-recorded checks</p></header>
        {!data?.exercises.length ? <EmptyState title="No recovery exercises recorded" description="Record an exercise after verifying backup availability or completing a restore test." />
          : <ul className="divide-y divide-slate-100">{data.exercises.map((exercise) => <li key={exercise.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-800">{exercise.kind === "RESTORE_TEST" ? "Restore test" : "Backup verification"} · {formatDate(exercise.testedAt)}</p><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${exercise.result === "PASSED" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{exercise.result}</span></div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{exercise.notes}</p><p className="mt-2 text-xs text-slate-400">Recorded by {exercise.recordedBy.firstName} {exercise.recordedBy.lastName}</p>
          </li>)}</ul>}
      </section>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Access review</h2><p className="mt-1 text-sm text-slate-500">Use the append-only audit log to review student-record access and administrative changes.</p>
      <div className="mt-3 flex flex-wrap gap-3"><Link href="/admin/audit-logs?action=VIEW_STUDENT" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-slate-50">Student record views</Link><Link href="/admin/audit-logs?action=VIEW_ENROLLMENTS" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-slate-50">Enrollment views</Link><Link href="/admin/audit-logs" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-slate-50">Open audit log</Link></div>
    </section>
  </div>;
}

function RecoveryStatus({ title, exercise }: Readonly<{ title: string; exercise?: Exercise }>) {
  const due = !exercise || exercise.result === "FAILED" ||
    addDays(exercise.testedAt.slice(0, 10), 90) <= manilaToday();
  return <article className={`rounded-xl border p-4 ${due ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold text-slate-900">{title}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${due ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{due ? "Due / review" : "Current"}</span></div>
    <p className="mt-2 text-sm text-slate-600">{exercise ? `Last recorded ${formatDate(exercise.testedAt)} · ${exercise.result.toLowerCase()}` : "No exercise has been recorded."}</p>
    <p className="mt-1 text-xs text-slate-500">Review every 90 days or after major database changes.</p>
  </article>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value));
}
