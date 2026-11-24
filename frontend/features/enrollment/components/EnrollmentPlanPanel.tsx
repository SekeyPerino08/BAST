"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "../../../components/shared";
import { ApiError } from "../../../lib/api";
import { useSections } from "../../sections/hooks";
import type { Section } from "../../sections/types";
import { useSchoolYears } from "../../school-years/hooks";
import {
  enrollmentRequirementCategories,
  type EnrollmentPlan,
  type EnrollmentRequirement,
  type EnrollmentRequirementCategory,
  type EnrollmentStrandTarget,
} from "../types";
import { useEnrollmentCapacity, useEnrollmentPlan, useSaveEnrollmentPlan } from "../hooks";

type PlanDraft = Pick<EnrollmentPlan, "registrationOpensAt" | "registrationClosesAt" | "firstDayOfClasses">
  & Pick<EnrollmentPlan, "requirements" | "specialPolicies" | "targets" | "gradeTargets">;

const categoryLabels: Record<EnrollmentRequirementCategory, string> = {
  NEW: "New student",
  RETURNING: "Returning student",
  TRANSFEREE: "Transferee",
  SCHOLARSHIP: "Scholarship",
  SUPPORT: "Support/accommodation",
  INTERNATIONAL: "International student",
  LATE: "Late applicant",
};

const policyFields: Array<{ key: keyof EnrollmentPlan["specialPolicies"]; label: string }> = [
  { key: "transfers", label: "Transfer and strand-change policy" },
  { key: "scholarships", label: "Scholarship policy" },
  { key: "support", label: "Accommodation and student-support policy" },
  { key: "international", label: "International-student policy" },
  { key: "lateApplicants", label: "Late-applicant policy" },
];

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function draftFromPlan(plan: EnrollmentPlan): PlanDraft {
  return {
    registrationOpensAt: dateInputValue(plan.registrationOpensAt),
    registrationClosesAt: dateInputValue(plan.registrationClosesAt),
    firstDayOfClasses: dateInputValue(plan.firstDayOfClasses),
    requirements: plan.requirements,
    specialPolicies: plan.specialPolicies,
    targets: plan.targets.map((target) => ({ ...target })),
    gradeTargets: plan.gradeTargets.map((target) => ({ ...target })),
  };
}

function targetKey(target: Pick<EnrollmentStrandTarget, "gradeLevel" | "strand">) {
  return `${target.gradeLevel}:${target.strand}`;
}

function sectionCapacitySummary(sections: Section[]) {
  const enrolled = sections.reduce((total, section) => total + (section._count?.enrollments ?? 0), 0);
  const capacityIsConfigured = sections.length > 0 && sections.every((section) => section.capacity !== null);
  const capacity = capacityIsConfigured
    ? sections.reduce((total, section) => total + (section.capacity ?? 0), 0)
    : null;
  return {
    sectionCount: sections.length,
    enrolled,
    capacity,
    remaining: capacity === null ? null : Math.max(0, capacity - enrolled),
  };
}

export function EnrollmentPlanPanel({ schoolYearId, onSchoolYearChange }: Readonly<{
  schoolYearId?: string;
  onSchoolYearChange: (id: string) => void;
}>) {
  const schoolYearsQuery = useSchoolYears();
  const planQuery = useEnrollmentPlan(schoolYearId ?? "");
  const capacityQuery = useEnrollmentCapacity(schoolYearId ?? "");
  const sectionsQuery = useSections({ page: 1, pageSize: 100, schoolYearId }, Boolean(schoolYearId), false);
  const savePlan = useSaveEnrollmentPlan(schoolYearId ?? "");
  const [savedDraft, setSavedDraft] = useState<{ schoolYearId: string; updatedAt: number; value: PlanDraft } | null>(null);
  const draft = planQuery.data?.data
    ? savedDraft && savedDraft.schoolYearId === schoolYearId && savedDraft.updatedAt === planQuery.dataUpdatedAt
      ? savedDraft.value
      : draftFromPlan(planQuery.data.data)
    : null;

  function setDraft(next: PlanDraft | ((current: PlanDraft) => PlanDraft)) {
    if (!draft) return;
    setSavedDraft({
      schoolYearId: schoolYearId ?? "",
      updatedAt: planQuery.dataUpdatedAt,
      value: typeof next === "function" ? next(draft) : next,
    });
  }

  const sectionsByTarget = useMemo(() => {
    const grouped = new Map<string, Section[]>();
    for (const section of sectionsQuery.data?.data ?? []) {
      if (!section.strand || section.gradeLevel < 11) continue;
      const key = `${section.gradeLevel}:${section.strand}`;
      grouped.set(key, [...(grouped.get(key) ?? []), section]);
    }
    return grouped;
  }, [sectionsQuery.data?.data]);

  const sectionsByGrade = useMemo(() => {
    const grouped = new Map<number, Section[]>();
    for (const section of sectionsQuery.data?.data ?? []) {
      if (section.gradeLevel < 7 || section.gradeLevel > 10) continue;
      grouped.set(section.gradeLevel, [...(grouped.get(section.gradeLevel) ?? []), section]);
    }
    return grouped;
  }, [sectionsQuery.data?.data]);

  if (!schoolYearId) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Create or select a school year before configuring enrollment.</div>;
  }
  if (planQuery.isError) {
    return <ErrorState title="Could not load enrollment settings" error={planQuery.error} retry={() => void planQuery.refetch()} />;
  }
  if (!draft || planQuery.isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading enrollment settings…</div>;
  }
  const currentDraft = draft;

  function setTarget(index: number, field: "expectedNew" | "expectedReturning" | "plannedSections", rawValue: string) {
    setDraft((current) => ({
      ...current,
      targets: current.targets.map((target, targetIndex) => targetIndex === index
        ? { ...target, [field]: rawValue === "" ? null : Number(rawValue) }
        : target),
    }));
  }

  function setGradeTarget(index: number, field: "expectedNew" | "expectedReturning" | "plannedSections", rawValue: string) {
    setDraft((current) => ({
      ...current,
      gradeTargets: current.gradeTargets.map((target, targetIndex) => targetIndex === index
        ? { ...target, [field]: rawValue === "" ? null : Number(rawValue) }
        : target),
    }));
  }

  function addRequirement() {
    setDraft((current) => ({
      ...current,
      requirements: [...current.requirements, { category: "NEW", name: "", required: true }],
    }));
  }

  function updateRequirement(index: number, updates: Partial<EnrollmentRequirement>) {
    setDraft((current) => ({
      ...current,
      requirements: current.requirements.map((requirement, requirementIndex) =>
        requirementIndex === index ? { ...requirement, ...updates } : requirement),
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentDraft.registrationOpensAt && currentDraft.registrationClosesAt &&
      currentDraft.registrationClosesAt < currentDraft.registrationOpensAt) {
      toast.error("Enrollment closing date must be on or after the opening date");
      return;
    }
    if (currentDraft.requirements.some((requirement) => !requirement.name.trim())) {
      toast.error("Enter a name for each required document");
      return;
    }
    try {
      await savePlan.mutateAsync({
        ...currentDraft,
        registrationOpensAt: currentDraft.registrationOpensAt || null,
        registrationClosesAt: currentDraft.registrationClosesAt || null,
        firstDayOfClasses: currentDraft.firstDayOfClasses || null,
      });
      toast.success("Enrollment plan saved");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save enrollment settings");
      if (error instanceof ApiError && error.status === 404) void planQuery.refetch();
    }
  }

  return <form onSubmit={(event) => void submit(event)} className="space-y-5">
    <div className="max-w-sm">
      <label className="block text-sm font-medium text-slate-700">School year
        <select value={schoolYearId} onChange={(event) => onSchoolYearChange(event.target.value)} className={`${inputClass} mt-1`}>
          {schoolYearsQuery.data?.data.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " (Current)" : ""}</option>)}
        </select>
      </label>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Enrollment setup</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">{planQuery.data?.data.schoolYear.name}</h2>
          <p className="mt-1 text-sm text-slate-500">Set the enrollment window and Grade 11–12 targets. Changes are recorded in the audit log.</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">Hybrid</span>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Cash payment</span>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <DateField label="Enrollment opens" value={currentDraft.registrationOpensAt} onChange={(value) => setDraft({ ...currentDraft, registrationOpensAt: value })} />
        <DateField label="Enrollment closes" value={currentDraft.registrationClosesAt} onChange={(value) => setDraft({ ...currentDraft, registrationClosesAt: value })} />
        <DateField label="First day of classes" value={currentDraft.firstDayOfClasses} onChange={(value) => setDraft({ ...currentDraft, firstDayOfClasses: value })} />
      </div>
    </section>

    <EnrollmentCapacityDashboard
      rows={capacityQuery.data?.data ?? []}
      isLoading={capacityQuery.isLoading}
      isError={capacityQuery.isError}
      retry={() => void capacityQuery.refetch()}
    />

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div><h3 className="font-semibold text-slate-900">Grade 7–10 targets</h3><p className="mt-1 text-xs text-slate-500">Plan enrollment and sections by grade. Capacity reflects all sections in each grade.</p></div>
        <Link href="/admin/sections" className="text-sm font-semibold text-indigo-700 hover:underline">Manage sections and caps</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="px-4 py-3">Grade</th><th className="px-4 py-3">Expected new</th><th className="px-4 py-3">Expected returning</th><th className="px-4 py-3">Planned sections</th><th className="px-4 py-3">Configured sections</th><th className="px-4 py-3">Enrolled / capacity</th><th className="px-4 py-3">Seats left</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {currentDraft.gradeTargets.map((target, index) => {
              const summary = sectionCapacitySummary(sectionsByGrade.get(target.gradeLevel) ?? []);
              return <tr key={target.gradeLevel}>
                <td className="px-4 py-3 font-medium text-slate-900">Grade {target.gradeLevel}</td>
                <NumberCell label={`Grade ${target.gradeLevel} expected new`} value={target.expectedNew} onChange={(value) => setGradeTarget(index, "expectedNew", value)} />
                <NumberCell label={`Grade ${target.gradeLevel} expected returning`} value={target.expectedReturning} onChange={(value) => setGradeTarget(index, "expectedReturning", value)} />
                <NumberCell label={`Grade ${target.gradeLevel} planned sections`} value={target.plannedSections} onChange={(value) => setGradeTarget(index, "plannedSections", value)} />
                <td className="px-4 py-3">{summary.sectionCount}</td>
                <td className="px-4 py-3">{summary.enrolled} / {summary.capacity ?? "Not fully configured"}</td>
                <td className="px-4 py-3">{summary.remaining ?? "—"}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {!sectionsQuery.isError && <p className="px-5 py-3 text-xs text-slate-500">A seat count is shown only when every section in that grade has a configured maximum.</p>}
      {sectionsQuery.isError && <p role="alert" className="px-5 py-3 text-sm text-rose-700">Section capacity data could not be loaded.</p>}
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div><h3 className="font-semibold text-slate-900">Grade 11–12 strand targets</h3><p className="mt-1 text-xs text-slate-500">Targets are planning estimates. Actual seat availability comes from section capacities.</p></div>
        <Link href="/admin/sections" className="text-sm font-semibold text-indigo-700 hover:underline">Manage sections and caps</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="px-4 py-3">Grade / strand</th><th className="px-4 py-3">Expected new</th><th className="px-4 py-3">Expected returning</th><th className="px-4 py-3">Planned sections</th><th className="px-4 py-3">Configured sections</th><th className="px-4 py-3">Enrolled / capacity</th><th className="px-4 py-3">Seats left</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {currentDraft.targets.map((target, index) => {
              const summary = sectionCapacitySummary(sectionsByTarget.get(targetKey(target)) ?? []);
              return <tr key={targetKey(target)}>
                <td className="px-4 py-3 font-medium text-slate-900">Grade {target.gradeLevel} · {target.strand === "TVL_ICT" ? "TVL-ICT" : target.strand}</td>
                <NumberCell label={`Grade ${target.gradeLevel} ${target.strand} expected new`} value={target.expectedNew} onChange={(value) => setTarget(index, "expectedNew", value)} />
                <NumberCell label={`Grade ${target.gradeLevel} ${target.strand} expected returning`} value={target.expectedReturning} onChange={(value) => setTarget(index, "expectedReturning", value)} />
                <NumberCell label={`Grade ${target.gradeLevel} ${target.strand} planned sections`} value={target.plannedSections} onChange={(value) => setTarget(index, "plannedSections", value)} />
                <td className="px-4 py-3">{summary.sectionCount}</td>
                <td className="px-4 py-3">{summary.enrolled} / {summary.capacity ?? "Not fully configured"}</td>
                <td className="px-4 py-3">{summary.remaining ?? "—"}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {!sectionsQuery.isError && <p className="px-5 py-3 text-xs text-slate-500">A seat count is shown only when every section in that strand has a configured maximum. New Grade 11/12 sections require a strand.</p>}
      {sectionsQuery.isError && <p role="alert" className="px-5 py-3 text-sm text-rose-700">Section capacity data could not be loaded.</p>}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-semibold text-slate-900">Required documents</h3><p className="mt-1 text-xs text-slate-500">Configure the checklist by applicant category. Verify requirements against current school policy.</p></div>
        <button type="button" onClick={addRequirement} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Add document</button>
      </div>
      {currentDraft.requirements.length === 0 ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No document requirements configured yet.</p> : (
        <div className="mt-4 space-y-3">
          {currentDraft.requirements.map((requirement, index) => <div key={`${index}-${requirement.category}`} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[200px_minmax(200px,1fr)_120px_40px]">
            <label className="text-xs font-medium text-slate-600">Applicant category
              <select value={requirement.category} onChange={(event) => updateRequirement(index, { category: event.target.value as EnrollmentRequirementCategory })} className={`${inputClass} mt-1`}>
                {enrollmentRequirementCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">Document or requirement
              <input value={requirement.name} onChange={(event) => updateRequirement(index, { name: event.target.value })} maxLength={160} className={`${inputClass} mt-1`} placeholder="Requirement name" />
            </label>
            <label className="flex items-center gap-2 pt-5 text-sm text-slate-700"><input type="checkbox" checked={requirement.required} onChange={(event) => updateRequirement(index, { required: event.target.checked })} /> Required</label>
            <button type="button" aria-label={`Remove ${requirement.name || "document requirement"}`} onClick={() => setDraft({ ...currentDraft, requirements: currentDraft.requirements.filter((_, itemIndex) => itemIndex !== index) })} className="mt-4 rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 size={17} /></button>
          </div>)}
        </div>
      )}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">Existing special-case policies</h3>
      <p className="mt-1 text-xs text-slate-500">Record the current BAST policy summary and staff routing instructions. Keep student-specific details in restricted student records, not here.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {policyFields.map(({ key, label }) => <label key={key} className="text-sm font-medium text-slate-700">{label}
          <textarea value={currentDraft.specialPolicies[key]} onChange={(event) => setDraft({
            ...currentDraft,
            specialPolicies: { ...currentDraft.specialPolicies, [key]: event.target.value },
          })} maxLength={4000} rows={3} className={`${inputClass} mt-1`} placeholder="Enter the approved policy or referral process" />
        </label>)}
      </div>
    </section>

    <div className="sticky bottom-3 z-10 flex justify-end">
      <button type="submit" disabled={savePlan.isPending || sectionsQuery.isLoading} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60">
        <Save size={17} /> {savePlan.isPending ? "Saving…" : "Save enrollment plan"}
      </button>
    </div>
  </form>;
}

function DateField({ label, value, onChange }: Readonly<{ label: string; value: string | null; onChange: (value: string | null) => void }>) {
  return <label className="block text-sm font-medium text-slate-700">{label}
    <span className="relative mt-1 block"><input type="date" value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} className={`${inputClass} pr-9`} /><CalendarDays size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /></span>
  </label>;
}

function EnrollmentCapacityDashboard({ rows, isLoading, isError, retry }: Readonly<{
  rows: Array<{
    gradeLevel: number;
    strand: string | null;
    expectedEnrollment: number | null;
    enrolled: number;
    sectionCount: number;
    capacity: number | null;
    seatsLeft: number | null;
    overCapacity: boolean;
    belowTarget: boolean;
  }>;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}>) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="enrollment-capacity-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="enrollment-capacity-heading" className="text-lg font-semibold text-slate-900">Enrollment vs capacity</h2><p className="mt-1 text-sm text-slate-500">Actual enrollments compared with planned targets for Grades 7–12.</p></div>
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-800">Over capacity</span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">Below target</span>
      </div>
    </div>
    {isError ? <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">Capacity summary could not be loaded. <button type="button" onClick={retry} className="font-semibold underline">Retry</button></p>
      : isLoading ? <p className="mt-4 text-sm text-slate-500" role="status">Loading enrollment summary…</p>
        : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const label = row.strand
              ? `Grade ${row.gradeLevel} · ${row.strand === "TVL_ICT" ? "TVL-ICT" : row.strand}`
              : `Grade ${row.gradeLevel}`;
            const progress = row.expectedEnrollment && row.expectedEnrollment > 0
              ? Math.min(100, Math.round((row.enrolled / row.expectedEnrollment) * 100))
              : 0;
            const status = row.overCapacity
              ? { label: "Over capacity", className: "bg-rose-50 text-rose-800" }
              : row.belowTarget
                ? { label: "Below target", className: "bg-amber-50 text-amber-800" }
                : row.expectedEnrollment === null
                  ? { label: "Target not set", className: "bg-slate-100 text-slate-700" }
                  : { label: "On track", className: "bg-emerald-50 text-emerald-800" };
            const barClass = row.overCapacity ? "bg-rose-500" : row.belowTarget ? "bg-amber-500" : "bg-emerald-500";
            return <article key={`${row.gradeLevel}:${row.strand ?? "JHS"}`} className={`rounded-xl border p-4 ${row.overCapacity ? "border-rose-200" : row.belowTarget ? "border-amber-200" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-slate-900">{label}</h3><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span></div>
              <p className="mt-3 text-sm text-slate-700"><strong>{row.enrolled}</strong>{row.expectedEnrollment === null ? " enrolled" : ` / ${row.expectedEnrollment} planned`}{row.capacity === null ? "" : ` · ${row.capacity} capacity`}</p>
              {row.expectedEnrollment !== null && <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${label} enrollment progress`} aria-valuemin={0} aria-valuemax={row.expectedEnrollment} aria-valuenow={Math.min(row.enrolled, row.expectedEnrollment)}>
                <div className={`h-full rounded-full ${barClass}`} style={{ width: `${progress}%` }} />
              </div>}
              <p className="mt-2 text-xs text-slate-500">{row.sectionCount} configured section{row.sectionCount === 1 ? "" : "s"} · {row.seatsLeft === null ? "Capacity incomplete" : `${row.seatsLeft} seat${row.seatsLeft === 1 ? "" : "s"} left`}</p>
            </article>;
          })}
        </div>}
  </section>;
}

function NumberCell({ label, value, onChange }: Readonly<{ label: string; value: number | null; onChange: (value: string) => void }>) {
  return <td className="px-4 py-3"><label className="sr-only">{label}</label><input type="number" min={0} max={100_000} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="w-28 rounded-lg border border-slate-300 px-2.5 py-2 text-sm" placeholder="—" /></td>;
}
