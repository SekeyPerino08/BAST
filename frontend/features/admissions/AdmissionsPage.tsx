"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal, ErrorState, EmptyState } from "../../components/shared";
import { ApiError, apiFetch } from "../../lib/api";
import { useCurrentSchoolYear } from "../school-years/hooks";
import { useSections } from "../sections/hooks";
import type { Section } from "../sections/types";
import { seniorHighStrands } from "../enrollment/types";

type AdmissionStage = "DOCUMENT_COLLECTION" | "REVIEW" | "ACCEPTED" | "ENROLLMENT" | "ENROLLED";
type Applicant = {
  id: string;
  schoolYearId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gradeLevel: number;
  strand: string | null;
  guardianName: string | null;
  guardianContact: string | null;
  documents: Array<{ id: string; name: string; required: boolean; received: boolean }>;
  stage: AdmissionStage;
  studentId: string | null;
  student: { studentNo: string } | null;
  createdAt: string;
};

const stages: Array<{ id: AdmissionStage; label: string }> = [
  { id: "DOCUMENT_COLLECTION", label: "Document collection" },
  { id: "REVIEW", label: "Review" },
  { id: "ACCEPTED", label: "Accepted" },
  { id: "ENROLLMENT", label: "Enrollment" },
  { id: "ENROLLED", label: "Enrolled" },
];

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function AdmissionsPage() {
  const client = useQueryClient();
  const currentYear = useCurrentSchoolYear();
  const yearId = currentYear.data?.data.id ?? "";
  const sectionsQuery = useSections({ page: 1, pageSize: 100, schoolYearId: yearId }, Boolean(yearId), false);
  const [creating, setCreating] = useState(false);
  const [enrolling, setEnrolling] = useState<Applicant | null>(null);
  const [draft, setDraft] = useState({ firstName: "", middleName: "", lastName: "", gradeLevel: "7", strand: "", guardianName: "", guardianContact: "" });
  const [enrollmentDraft, setEnrollmentDraft] = useState({ studentNo: "", birthDate: "", sex: "", address: "", sectionId: "", confirmDuplicate: false });
  const applicants = useQuery({
    queryKey: ["admissions", yearId],
    queryFn: () => apiFetch<{ data: Applicant[] }>(`/api/admissions${yearId ? `?schoolYearId=${encodeURIComponent(yearId)}` : ""}`),
    enabled: Boolean(yearId),
  });
  const invalidate = () => client.invalidateQueries({ queryKey: ["admissions"] });
  const createApplicant = useMutation({
    mutationFn: (input: typeof draft) => apiFetch("/api/admissions", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        gradeLevel: Number(input.gradeLevel),
        strand: input.strand || null,
        middleName: input.middleName || null,
        guardianName: input.guardianName || null,
        guardianContact: input.guardianContact || null,
      }),
    }),
    onSuccess: async () => {
      await invalidate();
      setCreating(false);
      setDraft({ firstName: "", middleName: "", lastName: "", gradeLevel: "7", strand: "", guardianName: "", guardianContact: "" });
      toast.success("Applicant added to document collection");
    },
  });
  const updateDocuments = useMutation({
    mutationFn: ({ applicantId, documents }: { applicantId: string; documents: Applicant["documents"] }) =>
      apiFetch(`/api/admissions/${encodeURIComponent(applicantId)}/documents`, {
        method: "PUT",
        body: JSON.stringify({ documents: documents.map(({ id, received }) => ({ id, received })) }),
      }),
    onSuccess: invalidate,
  });
  const advance = useMutation({
    mutationFn: ({ applicantId, stage }: { applicantId: string; stage: string }) =>
      apiFetch(`/api/admissions/${encodeURIComponent(applicantId)}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      }),
    onSuccess: invalidate,
  });
  const enroll = useMutation({
    mutationFn: ({ applicant, form }: { applicant: Applicant; form: typeof enrollmentDraft }) =>
      apiFetch<{ data: { accountEmail: string } }>(`/api/admissions/${encodeURIComponent(applicant.id)}/enroll`, {
        method: "POST",
        body: JSON.stringify({
          sectionId: form.sectionId,
          student: {
            studentNo: form.studentNo,
            firstName: applicant.firstName,
            middleName: applicant.middleName,
            lastName: applicant.lastName,
            sex: form.sex,
            birthDate: form.birthDate,
            address: form.address || null,
            guardianName: applicant.guardianName,
            guardianContact: applicant.guardianContact,
            confirmDuplicate: form.confirmDuplicate,
          },
        }),
      }),
    onSuccess: async (result: { data: { accountEmail: string } }) => {
      await invalidate();
      setEnrolling(null);
      toast.success(`Student enrolled. Account: ${result.data.accountEmail}`);
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not enroll applicant"),
  });

  const sectionList = sectionsQuery.data?.data ?? [];
  const rows = applicants.data?.data ?? [];

  async function submitEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrolling || !enrollmentDraft.sex) return;
    try {
      await enroll.mutateAsync({ applicant: enrolling, form: enrollmentDraft });
    } catch (error) {
      if (error instanceof ApiError && error.code === "POSSIBLE_DUPLICATE") {
        toast.error("A matching student may already exist. Verify the record before confirming the duplicate checkbox.");
      }
    }
  }

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Administration</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Admissions</h1><p className="mt-2 text-sm text-slate-500">Move applicants from required documents through review, acceptance, and enrollment.</p></div>
      <button type="button" onClick={() => setCreating(true)} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Add applicant</button>
    </header>
    {applicants.isError ? <ErrorState title="Could not load applicants" error={applicants.error} retry={() => void applicants.refetch()} />
      : applicants.isLoading ? <p role="status" className="rounded-xl bg-white p-5 text-sm text-slate-500">Loading admissions…</p>
        : !rows.length ? <EmptyState title="No applicants for this school year" description="Add an applicant to begin the document-collection stage." />
          : <div className="grid gap-4 xl:grid-cols-5">
            {stages.map((stage) => {
              const stageRows = rows.filter((applicant) => applicant.stage === stage.id);
              return <section key={stage.id} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3" aria-label={`${stage.label}: ${stageRows.length}`}>
                <header className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-800">{stage.label}</h2><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{stageRows.length}</span></header>
                <div className="space-y-3">
                  {stageRows.map((applicant) => <article key={applicant.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="font-semibold text-slate-900">{applicant.lastName}, {applicant.firstName}{applicant.middleName ? ` ${applicant.middleName}` : ""}</h3>
                    <p className="mt-1 text-xs text-slate-500">Grade {applicant.gradeLevel}{applicant.strand ? ` · ${applicant.strand === "TVL_ICT" ? "TVL-ICT" : applicant.strand}` : ""}</p>
                    {applicant.guardianContact && <p className="mt-1 text-xs text-slate-500">Guardian: {applicant.guardianContact}</p>}
                    {stage.id === "DOCUMENT_COLLECTION" && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      {applicant.documents.length ? applicant.documents.map((document) => <label key={document.id} className="flex items-start gap-2 text-xs text-slate-700">
                        <input type="checkbox" checked={document.received} disabled={updateDocuments.isPending} onChange={(event) => {
                          const documents = applicant.documents.map((item) => item.id === document.id ? { ...item, received: event.target.checked } : item);
                          updateDocuments.mutate({ applicantId: applicant.id, documents });
                        }} />
                        <span>{document.name}{document.required && <span className="text-rose-700"> *</span>}</span>
                      </label>) : <p className="text-xs text-slate-500">No required documents configured for new applicants.</p>}
                    </div>}
                    {stage.id === "ENROLLED" && <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs font-medium text-emerald-800">Enrolled{applicant.student?.studentNo ? ` · ${applicant.student.studentNo}` : ""}</p>}
                    {stage.id === "ENROLLMENT" && <button type="button" onClick={() => {
                      setEnrolling(applicant);
                      setEnrollmentDraft({ studentNo: "", birthDate: "", sex: "", address: "", sectionId: "", confirmDuplicate: false });
                    }} className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Complete enrollment</button>}
                    {stage.id !== "ENROLLED" && stage.id !== "ENROLLMENT" && <button type="button" disabled={advance.isPending || (stage.id === "DOCUMENT_COLLECTION" && applicant.documents.some((item) => item.required && !item.received))} onClick={() => {
                      const next = stage.id === "DOCUMENT_COLLECTION" ? "REVIEW" : stage.id === "REVIEW" ? "ACCEPTED" : "ENROLLMENT";
                      advance.mutate({ applicantId: applicant.id, stage: next });
                    }} className="mt-3 w-full rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                      {stage.id === "DOCUMENT_COLLECTION" ? "Send to review" : stage.id === "REVIEW" ? "Accept applicant" : "Start enrollment"}
                    </button>}
                  </article>)}
                  {!stageRows.length && <p className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-xs text-slate-400">No applicants</p>}
                </div>
              </section>;
            })}
          </div>}

    {creating && <Modal title="Add applicant" onClose={() => setCreating(false)} size="max-w-xl">
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createApplicant.mutate(draft); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">First name<input required value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="text-sm font-medium">Last name<input required value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="text-sm font-medium">Middle name<input value={draft.middleName} onChange={(event) => setDraft({ ...draft, middleName: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="text-sm font-medium">Applying for grade<select value={draft.gradeLevel} onChange={(event) => setDraft({ ...draft, gradeLevel: event.target.value, strand: "" })} className={`${inputClass} mt-1`}>{[7, 8, 9, 10, 11, 12].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label>
          {Number(draft.gradeLevel) >= 11 && <label className="text-sm font-medium">Strand<select required value={draft.strand} onChange={(event) => setDraft({ ...draft, strand: event.target.value })} className={`${inputClass} mt-1`}><option value="">Select strand</option>{seniorHighStrands.map((strand) => <option key={strand} value={strand}>{strand === "TVL_ICT" ? "TVL-ICT" : strand}</option>)}</select></label>}
          <label className="text-sm font-medium">Guardian name<input value={draft.guardianName} onChange={(event) => setDraft({ ...draft, guardianName: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="text-sm font-medium">Guardian contact<input value={draft.guardianContact} onChange={(event) => setDraft({ ...draft, guardianContact: event.target.value })} className={`${inputClass} mt-1`} /></label>
        </div>
        {createApplicant.isError && <p role="alert" className="text-sm text-rose-700">{createApplicant.error instanceof Error ? createApplicant.error.message : "Could not add applicant."}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setCreating(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={createApplicant.isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{createApplicant.isPending ? "Adding…" : "Add applicant"}</button></div>
      </form>
    </Modal>}

    {enrolling && <Modal title={`Enroll ${enrolling.firstName} ${enrolling.lastName}`} onClose={() => setEnrolling(null)} size="max-w-xl">
      <form className="space-y-4" onSubmit={(event) => void submitEnrollment(event)}>
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">This creates the student account and enrollment in one transaction. Student accounts must change their temporary password at first sign-in.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Student number<input required value={enrollmentDraft.studentNo} onChange={(event) => setEnrollmentDraft({ ...enrollmentDraft, studentNo: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="text-sm font-medium">Sex<select required value={enrollmentDraft.sex} onChange={(event) => setEnrollmentDraft({ ...enrollmentDraft, sex: event.target.value })} className={`${inputClass} mt-1`}><option value="">Select</option><option value="FEMALE">Female</option><option value="MALE">Male</option></select></label>
          <label className="text-sm font-medium">Birth date<input required type="date" value={enrollmentDraft.birthDate} onChange={(event) => setEnrollmentDraft({ ...enrollmentDraft, birthDate: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="text-sm font-medium">Section<select required value={enrollmentDraft.sectionId} onChange={(event) => setEnrollmentDraft({ ...enrollmentDraft, sectionId: event.target.value })} className={`${inputClass} mt-1`}><option value="">Select section</option>{sectionList.filter((section: Section) => section.gradeLevel === enrolling.gradeLevel && section.strand === enrolling.strand).map((section: Section) => <option key={section.id} value={section.id}>{section.name}{section.capacity === null ? "" : ` · ${section._count?.enrollments ?? 0}/${section.capacity}`}</option>)}</select></label>
          <label className="text-sm font-medium sm:col-span-2">Address<input value={enrollmentDraft.address} onChange={(event) => setEnrollmentDraft({ ...enrollmentDraft, address: event.target.value })} className={`${inputClass} mt-1`} /></label>
        </div>
        {sectionsQuery.isError && <p role="alert" className="text-sm text-rose-700">Could not load sections. Refresh before enrolling.</p>}
        <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={enrollmentDraft.confirmDuplicate} onChange={(event) => setEnrollmentDraft({ ...enrollmentDraft, confirmDuplicate: event.target.checked })} /><span>I verified this is not a duplicate student record (required only when a possible match is found).</span></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setEnrolling(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={enroll.isPending || sectionsQuery.isError || !sectionList.some((section: Section) => section.id === enrollmentDraft.sectionId)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{enroll.isPending ? "Enrolling…" : "Create student and enroll"}</button></div>
      </form>
    </Modal>}
  </div>;
}
