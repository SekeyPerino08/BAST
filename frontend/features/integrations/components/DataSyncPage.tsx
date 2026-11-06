"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { ApiError, apiFetch } from "../../../lib/api";
import { ConfirmDialog, EmptyState, ErrorState } from "../../../components/shared";
import { PageHeader } from "../../../components/ui";
import { toast } from "sonner";

const sources = [
  { id: "lms", title: "Learning management system", description: "Login, submission, and quiz events." },
  { id: "library", title: "Library system", description: "Book loans, due dates, and returns." },
  { id: "alumni", title: "Alumni relations", description: "Donations, events, and mentoring activity." },
] as const;
type Source = typeof sources[number]["id"];
type Reject = { id: string; rowNumber: number; raw: unknown; reason: string };
type Run = {
  id: string; source: string; mode: "PREVIEW" | "COMMIT"; startedAt: string;
  finishedAt: string | null; received: number; accepted: number; rejected: number;
  runBy?: { email: string } | null;
};
type SyncResult = { data: Run; rejects: Reject[] };
type RunsResponse = { data: Run[]; meta: { total: number } };

export function DataSyncPage() {
  const [active, setActive] = useState<{ source: Source; mode: string } | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState("");
  const [batch, setBatch] = useState<"current" | "next">("current");
  const [confirmSource, setConfirmSource] = useState<Source | null>(null);

  const runsQuery = useQuery({
    queryKey: ["integration-sync", "runs"],
    queryFn: () => apiFetch<RunsResponse>("/api/sync/runs?page=1&pageSize=25"),
  });
  const runs = runsQuery.data?.data ?? [];

  async function runSync(source: Source, mode: "preview" | "commit") {
    setActive({ source, mode });
    setError("");
    try {
      const response = await apiFetch<SyncResult>(`/api/sync/${source}?mode=${mode}&batch=${batch}`, { method: "POST" });
      setResult(response);
      toast.success(mode === "commit" ? "Sync committed" : "Preview completed");
      await runsQuery.refetch();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The sync could not be completed. Please try again.");
    } finally {
      setActive(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow="Administration" title="Data sync" description="Preview incoming integration data before committing it." />
        <label className="text-sm font-medium text-slate-700">Batch
          <select value={batch} onChange={(event) => setBatch(event.target.value as "current" | "next")} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
            <option value="current">Current batch</option><option value="next">Next batch</option>
          </select>
        </label>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
      <section className="grid gap-4 lg:grid-cols-3" aria-label="Integration sources">
        {sources.map((source) => (
          <article key={source.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">{source.title}</h2><p className="mt-1 min-h-10 text-sm text-slate-500">{source.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" disabled={Boolean(active)} onClick={() => void runSync(source.id, "preview")} className="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{active?.source === source.id && active.mode === "preview" ? "Previewing…" : "Preview"}</button>
              <button type="button" disabled={Boolean(active)} onClick={() => setConfirmSource(source.id)} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{active?.source === source.id && active.mode === "commit" ? "Committing…" : "Commit"}</button>
            </div>
          </article>
        ))}
      </section>

      {result && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div><h2 className="font-semibold text-slate-900">Latest {result.data.source.toUpperCase()} {result.data.mode.toLowerCase()} result</h2><p className="mt-1 text-xs text-slate-500">Run {result.data.id}</p></div>
          <div className="flex gap-4 text-sm"><span>Received <strong>{result.data.received}</strong></span><span className="text-emerald-700">Accepted <strong>{result.data.accepted}</strong></span><span className="text-rose-700">Rejected <strong>{result.data.rejected}</strong></span></div>
        </header>
        {result.rejects.length ? <RejectsTable rejects={result.rejects} /> : <p className="p-5 text-sm text-slate-500">No rejected rows.</p>}
      </section>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Run history</h2><p className="mt-1 text-xs text-slate-500">Latest 25 synchronization runs</p></div><button type="button" onClick={() => void runsQuery.refetch()} disabled={runsQuery.isFetching} aria-label="Refresh sync history" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><RefreshCw size={17} className={runsQuery.isFetching ? "animate-spin" : ""} /></button></header>
        {runsQuery.isError ? <ErrorState title="Could not load sync history" error={runsQuery.error} retry={() => void runsQuery.refetch()} />
          : runsQuery.isLoading ? <div className="animate-pulse space-y-3 p-5"><div className="h-5 rounded bg-slate-200" /><div className="h-5 rounded bg-slate-100" /><div className="h-5 rounded bg-slate-100" /></div>
            : !runs.length ? <EmptyState title="No sync runs yet" description="Preview a source to create the first run." />
              : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Source</th><th className="px-5 py-3">Mode</th><th className="px-5 py-3">Started</th><th className="px-5 py-3">Received</th><th className="px-5 py-3">Accepted</th><th className="px-5 py-3">Rejected</th><th className="px-5 py-3">Run by</th></tr></thead><tbody className="divide-y divide-slate-100">{runs.map((run) => <tr key={run.id}><td className="px-5 py-3 font-medium uppercase">{run.source}</td><td className="px-5 py-3">{run.mode.toLowerCase()}</td><td className="px-5 py-3">{new Date(run.startedAt).toLocaleString()}</td><td className="px-5 py-3">{run.received}</td><td className="px-5 py-3">{run.accepted}</td><td className="px-5 py-3">{run.rejected}</td><td className="px-5 py-3">{run.runBy?.email ?? "—"}</td></tr>)}</tbody></table></div>}
      </section>
      {confirmSource && <ConfirmDialog
        title={`Commit ${confirmSource.toUpperCase()} batch?`}
        description={`This will import and upsert accepted rows from the ${batch} ${confirmSource.toUpperCase()} batch. Rejected rows will be recorded in the run history.`}
        confirmLabel="Commit batch"
        destructive
        onClose={() => setConfirmSource(null)}
        onConfirm={() => {
          const source = confirmSource;
          setConfirmSource(null);
          void runSync(source, "commit");
        }}
      />}
    </div>
  );
}

function RejectsTable({ rejects }: Readonly<{ rejects: Reject[] }>) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Row</th><th className="px-5 py-3">Received data</th><th className="px-5 py-3">Reason</th></tr></thead><tbody className="divide-y divide-slate-100">{rejects.map((reject) => <tr key={reject.id}><td className="px-5 py-3">{reject.rowNumber}</td><td className="max-w-md px-5 py-3"><pre className="whitespace-pre-wrap break-all text-xs text-slate-600">{JSON.stringify(reject.raw, null, 2)}</pre></td><td className="px-5 py-3 text-rose-700">{reject.reason}</td></tr>)}</tbody></table></div>;
}
