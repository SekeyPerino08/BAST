"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Send } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "../../components/shared";
import { ApiError, apiFetch } from "../../lib/api";

type RequestType =
  | "CERTIFICATE_OF_ENROLLMENT"
  | "CERTIFICATE_OF_GOOD_MORAL_CHARACTER"
  | "TRANSCRIPT_OF_RECORDS"
  | "REPORT_CARD"
  | "CERTIFICATE_OF_COMPLETION"
  | "OTHER";

type RequestStatus =
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "REJECTED"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "CANCELLED";

type StudentRequest = {
  id: string;
  documentType: RequestType;
  reason: string;
  details: string | null;
  status: RequestStatus;
  requestedAt: string;
  processedAt: string | null;
  adminRemarks: string | null;
  documentUrl: string | null;
};

const requestTypes: Array<{ value: RequestType; label: string }> = [
  { value: "CERTIFICATE_OF_ENROLLMENT", label: "Certificate of enrollment" },
  { value: "CERTIFICATE_OF_GOOD_MORAL_CHARACTER", label: "Certificate of good moral character" },
  { value: "TRANSCRIPT_OF_RECORDS", label: "Transcript of records" },
  { value: "REPORT_CARD", label: "Report card" },
  { value: "CERTIFICATE_OF_COMPLETION", label: "Certificate of completion" },
  { value: "OTHER", label: "Other" },
];

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900";

export function StudentDocumentRequestsPage() {
  const client = useQueryClient();
  const [documentType, setDocumentType] = useState<RequestType>("CERTIFICATE_OF_ENROLLMENT");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const requests = useQuery({
    queryKey: ["my-document-requests"],
    queryFn: () => apiFetch<{ data: StudentRequest[] }>("/api/me/documents"),
  });
  const createRequest = useMutation({
    mutationFn: () => apiFetch<{ data: StudentRequest }>("/api/me/documents", {
      method: "POST",
      body: JSON.stringify({ documentType, reason, details: details || undefined }),
    }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["my-document-requests"] });
      setReason("");
      setDetails("");
      toast.success("Document request submitted");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not submit the request"),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createRequest.mutate();
  }

  const rows = requests.data?.data ?? [];

  return <div className="mx-auto max-w-6xl space-y-6">
    <header>
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Student portal</p>
      <h1 className="mt-1 text-3xl font-bold text-slate-900">Document Requests</h1>
      <p className="mt-2 text-sm text-slate-500">Request certificates or records, then track their processing status here.</p>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Submit a request</h2>
      <form className="mt-4 space-y-4" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Document type
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value as RequestType)} className={inputClass}>
              {requestTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Reason for request
            <input required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} placeholder="Briefly explain why you need this document" />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Additional details <span className="font-normal text-slate-500">(optional)</span>
          <textarea maxLength={2000} rows={3} value={details} onChange={(event) => setDetails(event.target.value)} className={inputClass} placeholder="Add any details that will help the school process your request" />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Your request will be sent to the school office for review.</p>
          <button type="submit" disabled={createRequest.isPending || !reason.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#0d412e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#135b3b] disabled:cursor-not-allowed disabled:opacity-50">
            <Send size={16} />{createRequest.isPending ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </form>
    </section>

    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Your requests</h2>
      {requests.isError ? <ErrorState title="Could not load document requests" error={requests.error} retry={() => void requests.refetch()} />
        : requests.isLoading ? <p role="status" className="rounded-xl border bg-white p-5 text-sm text-slate-500">Loading your requests…</p>
          : !rows.length ? <EmptyState title="No requests yet" description="Requests you submit will appear here with their latest status." />
            : <div className="grid gap-3 md:grid-cols-2">
              {rows.map((request) => <article key={request.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <FileText size={20} className="mt-0.5 shrink-0 text-indigo-600" />
                    <div><h3 className="font-semibold text-slate-900">{requestTypeLabel(request.documentType)}</h3><p className="mt-1 text-xs text-slate-500">Requested {formatDate(request.requestedAt)}</p></div>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-3 text-sm text-slate-700">{request.reason}</p>
                {request.details && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{request.details}</p>}
                {request.adminRemarks && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><strong>School update:</strong> {request.adminRemarks}</p>}
                {request.documentUrl && <a href={request.documentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-indigo-700 underline">Open document</a>}
              </article>)}
            </div>}
    </section>
  </div>;
}

function requestTypeLabel(value: RequestType) {
  return requestTypes.find((type) => type.value === value)?.label ?? "Document request";
}

function StatusBadge({ status }: { status: RequestStatus }) {
  const style: Record<RequestStatus, string> = {
    PENDING: "bg-amber-50 text-amber-800",
    PROCESSING: "bg-sky-50 text-sky-800",
    APPROVED: "bg-emerald-50 text-emerald-800",
    REJECTED: "bg-rose-50 text-rose-800",
    READY_FOR_PICKUP: "bg-indigo-50 text-indigo-800",
    COMPLETED: "bg-slate-100 text-slate-700",
    CANCELLED: "bg-slate-100 text-slate-500",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style[status]}`}>{statusLabel(status)}</span>;
}

function statusLabel(status: RequestStatus) {
  return status.split("_").map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(" ");
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(date);
}
