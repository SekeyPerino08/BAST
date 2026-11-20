"use client";

import Link from "next/link";
import { BookOpen, ClipboardCheck, Users } from "lucide-react";
import { ErrorState, EmptyState } from "../../../components/shared";
import { useMyClasses } from "../hooks";
import type { ClassOfferingRecord } from "../../enrollment/types";

export function TeacherClassesView({ purpose = "classes" }: Readonly<{ purpose?: "classes" | "attendance" }>) {
  const query = useMyClasses();
  if (query.isLoading) return <div className="mx-auto max-w-7xl animate-pulse space-y-5"><div className="h-10 w-64 rounded bg-slate-200" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-56 rounded-2xl bg-slate-200" />)}</div></div>;
  if (query.isError) return <ErrorState title="Could not load your classes" error={query.error} retry={() => void query.refetch()} />;
  const classes = query.data?.data ?? [];
  const advised = query.data?.advisedSection;
  const advisoryOffering = advised ? classes.find((offering) => offering.section.id === advised.id) : undefined;
  const attendanceView = purpose === "attendance";
  return <div className="mx-auto max-w-7xl space-y-6">
    <header><p className="text-sm font-semibold uppercase tracking-wide text-[#1d6a45]">{attendanceView ? "Attendance" : "Teaching"}</p><h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{attendanceView ? "My attendance" : "My Classes"}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{attendanceView ? "Review your assigned classes and open attendance for any class roster." : "Your class assignments for the current school year."}</p>{!attendanceView && <p className="mt-1 text-sm font-medium text-[#1d6a45] dark:text-[#dfeee4]">Choose a class to take attendance.</p>}</header>
    {advised && <aside className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#b9d7bf] bg-[#edf7ef] p-4 dark:border-[#315b43] dark:bg-[#183d2d]"><div><p className="font-semibold text-[#0d412e] dark:text-[#dfeee4]">You are the adviser of Grade {advised.gradeLevel} · {advised.name}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">View the enrolled student roster for this section.</p></div>{advisoryOffering ? <Link href={`/teacher/classes/${advisoryOffering.id}`} className="rounded-lg border border-[#b9d7bf] bg-white px-3 py-2 text-sm font-semibold text-[#0d412e] hover:bg-[#f2f8f4] dark:border-[#315b43] dark:bg-slate-900 dark:text-[#dfeee4]">Open roster</Link> : <span className="text-sm text-slate-600 dark:text-slate-300">No class roster link is available yet.</span>}</aside>}
    {!classes.length ? <EmptyState title="No classes assigned yet" description="Contact the administrator to be assigned to a class." /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{classes.map((item) => <ClassCard key={item.id} offering={item} />)}</div>}
  </div>;
}

export function ClassCard({ offering }: Readonly<{ offering: ClassOfferingRecord & { enrolledStudentCount: number } }>) {
  return <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_3px_14px_rgba(13,65,46,0.06)] transition hover:-translate-y-0.5 hover:border-[#b9d7bf] hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#1d6a45] dark:text-[#dfeee4]">{offering.subject.code}</p><h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{offering.subject.name}</h2></div><span className="rounded-xl bg-[#edf7ef] p-2 text-[#0d412e] dark:bg-[#183d2d] dark:text-[#dfeee4]"><BookOpen size={19} aria-hidden="true" /></span></div>
    <p className="mt-4 text-sm text-slate-600">Grade {offering.section.gradeLevel} · {offering.section.name}</p>
    <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><Users size={16} aria-hidden="true" /> {offering.enrolledStudentCount} students</p>
    <Link href={`/teacher/classes/${offering.id}`} className="mt-5 rounded-lg bg-[#1d6a45] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#0d412e]">View class</Link>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Link href={`/teacher/classes/${offering.id}/attendance`} aria-label={`Take attendance for ${offering.subject.name}, Grade ${offering.section.gradeLevel} ${offering.section.name}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#b9d7bf] px-2 py-2 text-xs font-semibold text-[#0d412e] hover:bg-[#edf7ef] dark:border-[#315b43] dark:text-[#dfeee4] dark:hover:bg-[#183d2d]"><ClipboardCheck size={15} /> Attendance</Link>
      <Link href={`/teacher/classes/${offering.id}/grades`} aria-label={`View grade sheet for ${offering.subject.name}, Grade ${offering.section.gradeLevel} ${offering.section.name}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><BookOpen size={15} /> Grades</Link>
    </div>
    <Link href={`/teacher/classes/${offering.id}/attendance/summary`} className="mt-3 self-start text-xs font-semibold text-slate-600 underline-offset-2 hover:text-[#1d6a45] hover:underline dark:text-slate-300 dark:hover:text-[#dfeee4]">Attendance summary</Link>
  </article>;
}
