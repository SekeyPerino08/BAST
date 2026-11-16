"use client";

import { useState } from "react";
import { toast } from "sonner";
import { friendlyApiMessage } from "../../../components/shared";
import { Modal } from "../../../components/shared/Modal";
import {
  useSetTermLocked,
  useSetTermReleased,
  useTermGradeCompleteness,
} from "../../grades/hooks";
import type { Term } from "../types";

type WorkflowAction = "lock" | "unlock" | "release" | "unrelease";

const actionLabels: Record<WorkflowAction, string> = {
  lock: "Lock grade entry",
  unlock: "Unlock grade entry",
  release: "Release grades",
  unrelease: "Withdraw release",
};

export function TermWorkflowControls({ schoolYearId, term }: Readonly<{
  schoolYearId: string;
  term: Term;
}>) {
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<WorkflowAction | null>(null);
  const [reason, setReason] = useState("");
  const completeness = useTermGradeCompleteness(schoolYearId, term.id, expanded);
  const lockTerm = useSetTermLocked();
  const releaseTerm = useSetTermReleased();
  const pending = lockTerm.isPending || releaseTerm.isPending;
  const missingCount = completeness.data?.missingGradeCount;
  const actionValue = action === "lock" ? true
    : action === "unlock" ? false
      : action === "release" ? true
        : false;

  async function confirmAction() {
    if (!action) return;
    const input = {
      schoolYearId,
      termId: term.id,
      value: actionValue,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    };
    try {
      if (action === "lock" || action === "unlock") {
        await lockTerm.mutateAsync(input);
      } else {
        await releaseTerm.mutateAsync(input);
      }
      toast.success(`${term.name}: ${action === "lock" ? "grade entry locked" : action === "unlock" ? "grade entry unlocked" : action === "release" ? "grades released" : "release withdrawn"}`);
      setAction(null);
      setReason("");
    } catch (error) {
      toast.error(friendlyApiMessage(error, `Could not ${actionLabels[action].toLowerCase()}`));
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${term.gradesLocked ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-800"}`}>
        {term.gradesLocked ? "Locked" : "Entry open"}
      </span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${term.gradesReleasedAt ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
        {term.gradesReleasedAt ? "Released" : "Not released"}
      </span>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        {expanded ? "Hide workflow" : "Manage grades"}
      </button>
      {expanded && (
        <div className="basis-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
          <div className="flex flex-wrap gap-2">
            {!term.gradesLocked
              ? <button type="button" onClick={() => setAction("lock")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Lock grade entry</button>
              : <button type="button" onClick={() => setAction("unlock")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Unlock grade entry</button>}
            {term.gradesReleasedAt
              ? <button type="button" onClick={() => setAction("unrelease")} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">Withdraw release</button>
              : <button
                  type="button"
                  onClick={() => setAction("release")}
                  disabled={!term.gradesLocked || completeness.isLoading || completeness.isError || missingCount !== 0}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {completeness.isLoading ? "Checking grades…" : "Release grades"}
                </button>}
          </div>
          {completeness.isLoading && <p className="mt-3 text-sm text-slate-500">Checking grade completeness…</p>}
          {completeness.isError && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-rose-700">
              <span>Could not check completeness.</span>
              <button type="button" onClick={() => void completeness.refetch()} className="font-semibold underline">Retry</button>
            </div>
          )}
          {completeness.data && (
            <>
              <p className={`mt-3 text-sm font-medium ${missingCount === 0 ? "text-emerald-800" : "text-amber-800"}`}>
                {missingCount === 0
                  ? `All grades are complete across ${completeness.data.classes.length} classes.`
                  : `${missingCount} grade${missingCount === 1 ? "" : "s"} missing across ${completeness.data.offeringsWithMissingGrades} class${completeness.data.offeringsWithMissingGrades === 1 ? "" : "es"}.`}
              </p>
              {completeness.data.classes.filter(({ missingCount: count }) => count > 0).length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {completeness.data.classes.filter(({ missingCount: count }) => count > 0).map((classItem) => (
                    <li key={classItem.classOfferingId}>
                      Grade {classItem.section.gradeLevel} · {classItem.section.name} · {classItem.subject.code}: {classItem.missingCount} missing
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
      {action && (
        <Modal
          title={actionLabels[action]}
          description={`${term.name} · ${action === "release" ? "Students will be able to view grades and report cards." : action === "unrelease" ? "Students will no longer see grades until they are released again." : action === "unlock" ? "Teachers can edit grades again; any current release will be withdrawn." : "Teachers will no longer be able to edit grades."}`}
          onClose={() => { if (!pending) setAction(null); }}
          disableClose={pending}
        >
          <form onSubmit={(event) => { event.preventDefault(); void confirmAction(); }} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Audit note <span className="font-normal text-slate-500">(optional)</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={3}
                disabled={pending}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAction(null)} disabled={pending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={pending || (action === "release" && missingCount !== 0)} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {pending ? "Saving…" : actionLabels[action]}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
