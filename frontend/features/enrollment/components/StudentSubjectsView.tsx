"use client";

import { BookOpen, UserRound } from "lucide-react";
import { EmptyState, ErrorState } from "../../../components/shared";
import { useMyEnrollment } from "../../class-offerings/hooks";

export function StudentSubjectsView() {
  const query = useMyEnrollment();
  if (query.isLoading) return <div className="mx-auto max-w-5xl animate-pulse space-y-5"><div className="h-9 w-48 rounded bg-slate-200" /><div className="h-40 rounded-2xl bg-slate-200" /><div className="h-72 rounded-2xl bg-slate-200" /></div>;
  if (query.isError) return <ErrorState title="Could not load your subjects" error={query.error} retry={() => void query.refetch()} />;
  const enrollment = query.data?.enrollment;
  const subjects = query.data?.classOfferings ?? [];
  if (!enrollment) return <div className="mx-auto max-w-5xl"><header className="mb-5"><h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Subjects</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your current school year classes.</p></header><EmptyState title="You are not enrolled for the current school year yet" description="Please contact the registrar for help with your enrollment." /></div>;
  const section = enrollment.section;
  if (!section) return <div className="mx-auto max-w-5xl"><header className="mb-5"><h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Subjects</h1></header><EmptyState title="Your section is not assigned yet" description="Please contact the registrar for help with your enrollment." /></div>;
  const adviser = section.adviser;
  return <div className="mx-auto max-w-5xl space-y-5">
    <header><p className="text-sm font-semibold uppercase tracking-wide text-[#1d6a45] dark:text-[#dfeee4]">Student portal</p><h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">My Subjects</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your section and assigned subject teachers.</p></header>
    <section className="grid gap-4 rounded-2xl border border-[#b9d7bf] bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-[#315b43] dark:bg-slate-900">
      <Info label="Grade level" value={`Grade ${section.gradeLevel}`} /><Info label="Section" value={section.name} /><Info label="School year" value={enrollment.schoolYear.name} /><Info label="Adviser" value={adviser ? `${adviser.firstName} ${adviser.middleName ? `${adviser.middleName} ` : ""}${adviser.lastName}` : "Not assigned"} />
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700"><h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><BookOpen size={18} className="text-[#1d6a45] dark:text-[#dfeee4]" /> Subjects ({subjects.length})</h2></div>
      {subjects.length ? <div className="divide-y divide-slate-100 dark:divide-slate-700">{subjects.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#1d6a45] dark:text-[#dfeee4]">{item.subject.code}</p><h3 className="mt-1 font-semibold text-slate-900 dark:text-white">{item.subject.name}</h3></div><p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><UserRound size={16} aria-hidden="true" /> {item.teacher.lastName}, {item.teacher.firstName}</p></article>)}</div> : <EmptyState title="No subjects assigned yet" description="Your subjects will appear here once the school assigns classes." />}
    </section>
  </div>;
}

function Info({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p><p className="mt-2 font-semibold text-slate-900 dark:text-white">{value}</p></div>;
}
