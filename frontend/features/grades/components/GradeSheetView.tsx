"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, GraduationCap, Save } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, friendlyApiMessage } from "../../../components/shared";
import { ApiError } from "../../../lib/api";
import { useAuth } from "../../../providers/AuthProvider";
import { useClassOffering } from "../../class-offerings/hooks";
import { useClassGradeSheet, useSaveClassGrades } from "../hooks";

export function GradeSheetView({ offeringId }: Readonly<{ offeringId: string }>) {
  const { user } = useAuth();
  const sheet = useClassGradeSheet(offeringId);
  const offering = useClassOffering(offeringId);
  const saveGrades = useSaveClassGrades(offeringId);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [draftScoresByTerm, setDraftScoresByTerm] = useState<Record<string, Record<string, string>>>({});

  const isAccessError = [sheet.error, offering.error].some(
    (error) => error instanceof ApiError && (error.status === 403 || error.status === 404),
  );

  if (isAccessError) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <h1 className="text-xl font-semibold text-slate-900">You don’t have access to this class</h1>
        <p className="mt-2 text-sm text-slate-500">The class may not exist or may not be assigned to your account.</p>
        <Link href={user?.role === "ADMIN" ? "/admin/sections" : "/teacher/classes"} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
          <ArrowLeft size={16} /> Back to classes
        </Link>
      </div>
    );
  }

  if (sheet.isLoading || offering.isLoading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-5">
        <div className="h-8 w-56 rounded bg-slate-200" />
        <div className="h-24 rounded-2xl bg-slate-200" />
        <div className="h-72 rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (sheet.isError || offering.isError || !offering.data || !sheet.data) {
    return (
      <ErrorState
        title="Could not load the grade sheet"
        error={sheet.error ?? offering.error}
        retry={() => {
          void sheet.refetch();
          void offering.refetch();
        }}
      />
    );
  }

  const item = offering.data;
  const classHref = user?.role === "ADMIN" ? `/admin/sections/${item.section.id}` : `/teacher/classes/${offeringId}`;
  const terms = sheet.data.terms;
  const roster = sheet.data.roster;
  const activeTermId = sheet.data.editableTermIds.includes(selectedTermId)
    ? selectedTermId
    : sheet.data.editableTermIds[0] ?? "";
  const draftScores = draftScoresByTerm[activeTermId] ?? {};
  const activeTerm = terms.find(({ id }) => id === activeTermId);
  const editable = Boolean(activeTerm && sheet.data.editableTermIds.includes(activeTerm.id));
  const invalidScore = Object.values(draftScores).some((value) => (
    value !== "" && (
      !Number.isFinite(Number(value))
      || Number(value) < 0
      || Number(value) > 100
      || Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) >= 1e-8
    )
  ));
  const isDirty = Boolean(activeTerm && roster.some((student) => {
    const original = student.scores[activeTerm.id];
    const draft = draftScores[student.studentId] ?? (original === null || original === undefined ? "" : String(original));
    return draft === "" ? original !== null && original !== undefined : Number(draft) !== original;
  }));

  async function submitGrades() {
    if (!activeTerm || invalidScore) return;
    try {
      await saveGrades.mutateAsync({
        termId: activeTerm.id,
        records: roster.map((student) => {
          const original = student.scores[activeTerm.id];
          const value = draftScores[student.studentId] ?? (original === null || original === undefined ? "" : String(original));
          const remarks = student.remarks[activeTerm.id];
          return {
            studentId: student.studentId,
            score: value === "" ? null : Number(value),
            ...(remarks ? { remarks } : {}),
          };
        }),
      });
      setDraftScoresByTerm((current) => {
        const next = { ...current };
        delete next[activeTerm.id];
        return next;
      });
      toast.success(`${activeTerm.name} grades saved`);
    } catch (error) {
      toast.error(friendlyApiMessage(error, "Could not save grades"));
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href={classHref} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-700">
        <ArrowLeft size={17} /> Back to class
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{item.subject.code}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{item.subject.name}</h1>
          <p className="mt-2 text-slate-600">Grade {item.section.gradeLevel} · {item.section.name}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
            <BookOpen size={15} /> {terms.length} terms
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
            <GraduationCap size={15} /> {roster.length} students
          </span>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 p-4 sm:px-5">
          <div>
            <label htmlFor="grade-term" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Grade entry term</label>
            <select
              id="grade-term"
              value={activeTermId}
              onChange={(event) => setSelectedTermId(event.target.value)}
              disabled={!sheet.data.editableTermIds.length || saveGrades.isPending}
              className="mt-1.5 min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:bg-slate-100"
            >
              {sheet.data.editableTermIds.length
                ? terms.filter(({ id }) => sheet.data.editableTermIds.includes(id)).map((term) => (
                    <option key={term.id} value={term.id}>{term.name}{term.gradesLocked ? " (Admin correction)" : ""}</option>
                  ))
                : <option value="">No editable terms</option>}
            </select>
            {activeTerm?.gradesLocked && !activeTerm.released && (
              <p className="mt-1 text-xs text-amber-700">{user?.role === "ADMIN" ? "Locked grades may be corrected until the term is released." : "This term is locked; ask an administrator to make a correction."}</p>
            )}
          </div>
          {editable && (
            <button
              type="button"
              onClick={() => void submitGrades()}
              disabled={!isDirty || invalidScore || saveGrades.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} /> {saveGrades.isPending ? "Saving…" : "Save grades"}
            </button>
          )}
        </div>
        {invalidScore && <p role="alert" className="px-5 pt-4 text-sm text-rose-700">Scores must be between 0 and 100 with at most two decimal places.</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                {terms.map((term) => (
                  <th key={term.id} className="px-3 py-3 text-center">
                    <div className="font-semibold text-slate-700">{term.name}</div>
                    <div className="mt-1 text-[10px] uppercase text-slate-400">
                      {term.released ? "Released" : term.gradesLocked ? "Locked" : "Open"}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center">Final grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roster.map((student) => (
                <tr key={student.studentId} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{student.lastName}, {student.firstName}{student.middleName ? ` ${student.middleName.charAt(0)}.` : ""}</div>
                    <div className="text-xs text-slate-500">{student.studentNo}</div>
                  </td>
                  {terms.map((term) => {
                    const value = student.scores[term.id];
                    const descriptor = student.remarks[term.id] ?? null;
                    const isEditableCell = editable && activeTermId === term.id;
                    return (
                      <td key={`${student.studentId}-${term.id}`} className="px-3 py-3 text-center">
                        {isEditableCell ? (
                          <input
                            aria-label={`${term.name} grade for ${student.firstName} ${student.lastName}`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            inputMode="decimal"
                            value={draftScores[student.studentId] ?? (value === null || value === undefined ? "" : String(value))}
                            onChange={(event) => setDraftScoresByTerm((current) => ({
                              ...current,
                              [activeTermId]: { ...(current[activeTermId] ?? {}), [student.studentId]: event.target.value },
                            }))}
                            disabled={saveGrades.isPending}
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-center font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100"
                          />
                        ) : (
                          <div className="font-semibold text-slate-800">
                            {value === null || value === undefined ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(2)}
                          </div>
                        )}
                        {descriptor ? <div className="mt-1 text-[11px] text-slate-500">{descriptor}</div> : null}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center">
                    <div className="font-bold text-slate-900">{student.finalGrade === null ? "—" : student.finalGrade}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{student.descriptor ?? "—"}</div>
                  </td>
                </tr>
              ))}
              {!roster.length && <tr><td colSpan={terms.length + 2} className="px-4 py-10 text-center text-slate-500">No enrolled students are assigned to this class.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
