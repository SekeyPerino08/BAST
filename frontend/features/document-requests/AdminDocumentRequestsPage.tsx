"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, ErrorState, Modal } from "../../components/shared";
import { ApiError, apiFetch } from "../../lib/api";

type RequestStatus =
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "REJECTED"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "CANCELLED";

type DocumentRequest = {
  id: string;
  documentType: string;
  reason: string;
  details: string | null;
  status: RequestStatus;
  requestedAt: string;
  processedAt: string | null;
  adminRemarks: string | null;
  student: { id: string; studentNo: string; firstName: string; middleName: string | null; lastName: string };
};

type UpdateStatus = "APPROVED" | "REJECTED" | "READY_FOR_PICKUP";
const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function AdminDocumentRequestsPage() {
  const client = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rejection, setRejection] = useState<{ id: string; reason: string } | null>(null);
  const requests = useQuery({
    queryKey: ["document-requests"],
    queryFn: () => apiFetch<{ data: DocumentRequest[] }>("/api/document-requests"),
  });
  const update = useMutation({
    mutationFn: ({ id, status, adminRemarks }: { id: string; status: UpdateStatus; adminRemarks: string | null }) => apiFetch(`/api/document-requests/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, adminRemarks }),
    }),
    onSuccess: async (_result, variables) => {
      setNotes((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      if (variables.status === "REJECTED") setRejection(null);
      await client.invalidateQueries({ queryKey: ["document-requests"] });
      toast.success(variables.status === "REJECTED" ? "Document request rejected" : "Document request updated");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not update the request"),
  });

  const rows = requests.data?.data ?? [];
  const openCount = rows.filter((request) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(request.status)).length;
  const rejectedRequest = rows.find((request) => request.id === rejection?.id);

  function updateStatus(request: DocumentRequest, status: UpdateStatus) {
    update.mutate({
      id: request.id,
      status,
      adminRemarks: (notes[request.id] ?? request.adminRemarks ?? "").trim() || null,
    });
  }

  function confirmRejection() {
    if (!rejection?.reason.trim()) return;
    update.mutate({
      id: rejection.id,
      status: "REJECTED",
      adminRemarks: rejection.reason.trim(),
    });
  }

  return <div className="mx-auto max-w-7xl space-y-6">
    <header>
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Administration</p>
      <h1 className="mt-1 text-3xl font-bold text-slate-900">Document Requests</h1>
      <p className="mt-2 text-sm text-slate-500">Review student document requests, update progress, and leave a note visible to the student.</p>
    </header>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <strong>{openCount}</strong> request{openCount === 1 ? "" : "s"} awaiting completion. Add a note whenever you change a request so the student can see the latest update.
    </div>
    {requests.isError ? <ErrorState title="Could not load document requests" error={requests.error} retry={() => void requests.refetch()} />
      : requests.isLoading ? <p role="status" className="rounded-xl border bg-white p-5 text-sm text-slate-500">Loading document requests…</p>
        : !rows.length ? <EmptyState title="No document requests" description="Student requests will appear here when submitted." />
          : <section className="space-y-3">
            {rows.map((request) => {
              const awaitingDecision = request.status === "PENDING" || request.status === "PROCESSING";
              const accepted = request.status === "APPROVED";
              const canUpdate = awaitingDecision || accepted;
              return <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{request.student.lastName}, {request.student.firstName}{request.student.middleName ? ` ${request.student.middleName}` : ""}</h2>
                    <p className="text-sm text-slate-500">Student No. {request.student.studentNo} · Requested {formatDate(request.requestedAt)}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{statusLabel(request.status)}</span>
                </div>
                <div className="mt-4 rounded-lg bg-slate-50 p-4">
                  <p className="font-medium text-slate-900">{documentTypeLabel(request.documentType)}</p>
                  <p className="mt-2 text-sm text-slate-700">{request.reason}</p>
                  {request.details && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{request.details}</p>}
                </div>
                {canUpdate
                  ? <label className="mt-4 block text-sm font-medium text-slate-700">Staff note for student <span className="font-normal text-slate-500">(optional)</span>
                    <textarea maxLength={2000} rows={2} value={notes[request.id] ?? request.adminRemarks ?? ""} onChange={(event) => setNotes({ ...notes, [request.id]: event.target.value })} className={`${inputClass} mt-1`} placeholder="Add a note to include with this status update" />
                  </label>
                  : request.adminRemarks && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><strong>Staff note for student:</strong> {request.adminRemarks}</p>}
                {request.processedAt && <p className="mt-2 text-xs text-slate-500">First processed {formatDate(request.processedAt)}</p>}
                {canUpdate && <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={update.isPending} onClick={() => updateStatus(request, accepted ? "READY_FOR_PICKUP" : "APPROVED")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{accepted ? "Ready for Pickup" : "Accept"}</button>
                  <button type="button" disabled={update.isPending} onClick={() => setRejection({ id: request.id, reason: "" })} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">Reject</button>
                </div>}
              </article>;
            })}
          </section>}
    {rejection && rejectedRequest && <Modal title="Reject document request" description="A rejection reason is required and will be shown to the student." onClose={() => setRejection(null)} disableClose={update.isPending} size="max-w-md">
      <label className="block text-sm font-medium text-slate-700">Reason for rejection
        <textarea required maxLength={2000} rows={4} value={rejection.reason} onChange={(event) => setRejection({ ...rejection, reason: event.target.value })} className={`${inputClass} mt-1`} placeholder="Explain why this request cannot be approved" />
      </label>
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" disabled={update.isPending} onClick={() => setRejection(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancel</button>
        <button type="button" disabled={update.isPending || !rejection.reason.trim()} onClick={confirmRejection} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{update.isPending ? "Rejecting…" : "Confirm rejection"}</button>
      </div>
    </Modal>}
  </div>;
}

function documentTypeLabel(value: string) {
  return value.split("_").map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(" ");
}

function statusLabel(status: RequestStatus) {
  return status.split("_").map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(" ");
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(date);
}
