"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import { formatDisplayDate } from "../../lib/dates";
import type { AdminDashboardData, TeacherDashboardData } from "../../types/dashboard";
import {
  filterSectionSizes,
  sectionCapacityStatus,
  sectionSizeAxisTicks,
  shortenSectionLabel,
  sortSectionSizes,
  type SectionSizesSort,
} from "./sectionSizes";
import { ChartCard } from "./components";

const COLORS = ["#0d412e", "#1d6a45", "#f0c35d", "#bd5b5b", "#56856b", "#7a8d9d"];
const gridColor = "#d7e4db";
const axisColor = "#526d63";
const tooltipStyle = { backgroundColor: "#fff", border: "1px solid #d7e4db", borderRadius: 10, color: "#0f172a" };

export function EnrollmentChart({ data }: Readonly<{ data: AdminDashboardData["enrollmentByGrade"] }>) {
  const rows = data.map((item) => ({ grade: `Grade ${item.gradeLevel}`, sections: item.sections, students: item.students }));
  return (
    <ChartCard
      title="Enrollment by grade level"
      description="Enrolled students and section counts"
      columns={[{ key: "grade", label: "Grade" }, { key: "sections", label: "Sections" }, { key: "students", label: "Students" }]}
      rows={rows}
      rowHref={() => "/admin/students"}
      action={<Link href="/admin/students" className="text-xs font-semibold text-[#1d6a45] hover:underline dark:text-[#dfeee4]">View students</Link>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 18, right: 12, left: -15, bottom: 0 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="grade" tick={{ fill: axisColor, fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="students" name="Students" fill={COLORS[0]} radius={[5, 5, 0, 0]}>
            <LabelList dataKey="students" position="top" fill={axisColor} fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function AttendanceTrendChart({ data }: Readonly<{ data: AdminDashboardData["attendanceTrend"] }>) {
  const rows = data.map((item) => ({ ...item, day: formatDisplayDate(item.date) }));
  return (
    <ChartCard
      title="Attendance, last recorded days"
      description="School-wide rate; days with no records are omitted"
      emptyMessage="No attendance recorded yet for the current school year."
      columns={[{ key: "day", label: "Date" }, { key: "present", label: "Present" }, { key: "absent", label: "Absent" }, { key: "late", label: "Late" }, { key: "excused", label: "Excused" }, { key: "rate", label: "Rate (%)" }]}
      rows={rows.map((row) => ({ ...row, rate: row.rate ?? "N/A" }))}
      rowHref={() => "/admin/sections"}
      action={<Link href="/admin/sections" className="text-xs font-semibold text-[#1d6a45] hover:underline dark:text-[#dfeee4]">View sections</Link>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 18, right: 12, left: -15, bottom: 34 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="day" angle={-25} textAnchor="end" interval="preserveStartEnd" height={55} tick={{ fill: axisColor, fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fill: axisColor, fontSize: 11 }} tickFormatter={(value: number) => `${value}%`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value ?? "N/A"}%`, "Rate"]} />
          <Line type="monotone" dataKey="rate" name="Attendance rate" stroke={COLORS[1]} strokeWidth={3} strokeDasharray="6 3" connectNulls={false} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SectionSizesChart({ data, enrolledTotal }: Readonly<{
  data: AdminDashboardData["sectionSizes"];
  enrolledTotal: number;
}>) {
  const [sortBy, setSortBy] = useState<SectionSizesSort>("grade");
  const [showAllSections, setShowAllSections] = useState(false);
  const [view, setView] = useState<"chart" | "table">("chart");
  const router = useRouter();
  const [tableSort, setTableSort] = useState<keyof AdminDashboardData["sectionSizes"][number]>("gradeLevel");
  const [tableSortDescending, setTableSortDescending] = useState(false);
  const totalStudents = data.reduce((total, section) => total + section.students, 0);
  const emptySections = data.filter((section) => section.students === 0).length;
  const sectionsWithoutAdviser = data.filter((section) => !section.adviserName).length;
  const sectionsWithoutOfferings = data.filter((section) => section.classOfferingCount === 0).length;
  const axisTicks = sectionSizeAxisTicks(data);
  const axisMaximum = axisTicks[axisTicks.length - 1] ?? 1;
  const sortedSections = sortSectionSizes(data, sortBy);
  const visibleSections = filterSectionSizes(sortedSections, showAllSections);
  const chartRows = visibleSections.map((section) => {
    const status = sectionCapacityStatus(section);
    return {
      ...section,
      chartLabel: shortenSectionLabel(section.gradeLevel, section.name),
      remainingCapacity: section.capacity === null ? 0 : Math.max(0, section.capacity - section.students),
      barLabel: section.capacity === null
        ? String(section.students)
        : `${section.students} / ${section.capacity}${status ? ` · ${status}` : ""}`,
    };
  });
  const chartHeight = Math.max(96, chartRows.length * 42 + 32);
  const tableSections = [...data].sort((a, b) => {
    const direction = tableSortDescending ? -1 : 1;
    if (tableSort === "gradeLevel") return direction * (a.gradeLevel - b.gradeLevel || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    if (tableSort === "students" || tableSort === "capacity" || tableSort === "classOfferingCount") {
      return direction * ((a[tableSort] ?? -1) as number - ((b[tableSort] ?? -1) as number));
    }
    return direction * (String(a[tableSort] ?? "").localeCompare(String(b[tableSort] ?? ""), undefined, { numeric: true, sensitivity: "base" }));
  });
  const setSort = (key: keyof AdminDashboardData["sectionSizes"][number]) => {
    if (tableSort === key) setTableSortDescending((descending) => !descending);
    else {
      setTableSort(key);
      setTableSortDescending(false);
    }
  };
  const discrepancy = totalStudents - enrolledTotal;

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5" aria-labelledby="section-sizes-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="section-sizes-title" className="font-semibold text-slate-900 dark:text-white">Section sizes</h2>
          <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {data.length} sections · {totalStudents.toLocaleString()} enrolled students
          </p>
        </div>
        <Link href="/admin/sections" className="text-sm font-semibold text-[#1d6a45] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] dark:text-[#dfeee4]">View sections</Link>
      </header>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1 dark:border-slate-600 dark:bg-slate-800" role="group" aria-label="Section sizes display">
          {(["chart", "table"] as const).map((nextView) => (
            <button key={nextView} type="button" aria-pressed={view === nextView} onClick={() => setView(nextView)} className={`min-h-9 rounded-md px-3 text-sm font-semibold capitalize focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1d6a45] ${view === nextView ? "bg-white text-[#0d412e] shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-600 hover:text-[#0d412e] dark:text-slate-300 dark:hover:text-white"}`}>
              {nextView}
            </button>
          ))}
        </div>
        {view === "chart" && (
          <button type="button" onClick={() => setSortBy((current) => current === "grade" ? "size" : "grade")} className="min-h-9 rounded-lg px-2 text-sm font-semibold text-[#1d6a45] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] dark:text-[#dfeee4]">
            {sortBy === "grade" ? "Sort by size" : "Sort by grade"}
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        <p>{sectionsWithoutAdviser} without an adviser · {sectionsWithoutOfferings} without class offerings</p>
        {emptySections > 0 && (
          <p role="status">
            {emptySections} sections have no enrolled students.{" "}
            <button type="button" onClick={() => setShowAllSections((show) => !show)} className="font-semibold text-[#1d6a45] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] dark:text-[#dfeee4]">
              {showAllSections ? "Hide empty sections" : "Show all sections"}
            </button>
          </p>
        )}
      </div>

      {discrepancy !== 0 && (
        <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Section enrollments total {totalStudents.toLocaleString()}, but the dashboard reports {enrolledTotal.toLocaleString()} ({Math.abs(discrepancy).toLocaleString()} {discrepancy > 0 ? "more" : "fewer"}).
        </p>
      )}

      {view === "chart" ? (
        data.length === 0 ? (
          <div className="mt-4 flex h-52 items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300" role="status">
            No sections are configured for this school year.
          </div>
        ) : totalStudents === 0 && !showAllSections ? (
          <div className="mt-4 flex h-52 flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 text-center text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300" role="status">
            <p>No students are enrolled in any section for this school year.</p>
          </div>
        ) : (
          <div className="mt-3">
            <div className="hidden max-h-56 overflow-y-auto sm:block" aria-label="Section enrollment chart">
              <div style={{ height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 112, left: 0, bottom: 4 }} accessibilityLayer>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis type="number" domain={[0, axisMaximum]} ticks={axisTicks} allowDecimals={false} tick={{ fill: axisColor, fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="chartLabel"
                      width={112}
                      interval={0}
                      tick={({ x, y, payload }) => {
                        const section = chartRows.find((row) => row.chartLabel === payload.value);
                        if (!section) return <g />;
                        const href = `/admin/sections/${encodeURIComponent(section.sectionId)}`;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <a href={href} aria-label={`${section.label}: ${section.students} ${section.students === 1 ? "student" : "students"}`}>
                              <title>{section.label} · Adviser: {section.adviserName ?? "Not assigned"} · Capacity: {section.capacity ?? "Not set"}</title>
                              <text x={-8} dy="0.35em" textAnchor="end" fill={axisColor} fontSize={12}>{section.chartLabel}</text>
                            </a>
                          </g>
                        );
                      }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      content={({ active, payload }) => {
                        const sectionId = payload?.[0]?.payload?.sectionId;
                        const section = data.find((item) => item.sectionId === String(sectionId));
                        if (!active || !section) return null;
                        const status = sectionCapacityStatus(section);
                        return (
                          <div className="rounded-lg border border-[#d7e4db] bg-white px-3 py-2 text-xs leading-5 text-slate-800 shadow-lg">
                            <strong className="block">{section.label}</strong>
                            <span>Adviser: {section.adviserName ?? "Not assigned"}</span><br />
                            <span>Enrolled: {section.students} · Capacity: {section.capacity ?? "Not set"}</span><br />
                            <span>{status ? `Capacity status: ${status}` : "Capacity status: not configured"}</span><br />
                            <span>{section.classOfferingCount} class offerings</span>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="students" name="Enrolled" stackId="capacity" radius={[0, 5, 5, 0]} barSize={18}>
                      {chartRows.map((row) => {
                        const status = sectionCapacityStatus(row);
                        const fill = status === "low" ? "#8a6710" : status === "full" ? "#0d412e" : "#1d6a45";
                        const href = `/admin/sections/${encodeURIComponent(row.sectionId)}`;
                        const ariaLabel = `${row.label}: ${row.students} ${row.students === 1 ? "student" : "students"}`;
                        return (
                          <Cell
                            key={row.sectionId}
                            fill={fill}
                            role="link"
                            tabIndex={0}
                            aria-label={ariaLabel}
                            onClick={() => router.push(href)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                router.push(href);
                              }
                            }}
                          />
                        );
                      })}
                      <LabelList dataKey="barLabel" position="right" fill={axisColor} fontSize={12} />
                    </Bar>
                    <Bar dataKey="remainingCapacity" name="Remaining capacity" stackId="capacity" fill="#e8eee9" radius={[0, 5, 5, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="ml-[6.6rem] mr-16 flex justify-between px-1 text-xs text-slate-600 dark:text-slate-300 sm:hidden" aria-hidden="true">
              {axisTicks.map((tick) => <span key={tick}>{tick}</span>)}
            </div>
            <ul className="mt-1 max-h-56 space-y-0.5 overflow-y-auto pr-1 sm:hidden" aria-label="Enrolled students by section">
              {visibleSections.map((section) => {
                const status = sectionCapacityStatus(section);
                const barWidth = Math.min(100, (section.students / axisMaximum) * 100);
                const capacityPosition = section.capacity === null ? null : Math.min(100, (section.capacity / axisMaximum) * 100);
                const labelPosition = barWidth > 60 ? barWidth - 25 : barWidth;
                const sectionUrl = `/admin/sections/${encodeURIComponent(section.sectionId)}`;
                const accessibleName = `${section.label}: ${section.students} ${section.students === 1 ? "student" : "students"}`;
                return (
                  <li key={section.sectionId}>
                    <Link href={sectionUrl} aria-label={accessibleName} aria-describedby={`section-tooltip-${section.sectionId}`} title={`${section.label} · Adviser: ${section.adviserName ?? "Not assigned"} · ${section.students} enrolled · Capacity: ${section.capacity ?? "Not set"}`} className="group relative grid min-h-11 grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-1 text-xs text-slate-700 outline-none hover:bg-[#f2f8f4] focus-visible:bg-[#f2f8f4] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1d6a45] dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800 sm:grid-cols-[7rem_minmax(0,1fr)_auto]">
                      <span className="truncate whitespace-nowrap text-xs font-semibold" title={section.label}>{shortenSectionLabel(section.gradeLevel, section.name)}</span>
                      <span className="relative block h-4 rounded-full bg-[#e8eee9] dark:bg-slate-700" role="progressbar" aria-label={`${section.label} enrolled students`} aria-valuemin={0} aria-valuemax={axisMaximum} aria-valuenow={section.students} aria-valuetext={`${section.students} enrolled${section.capacity === null ? "" : `, capacity ${section.capacity}`}`}>
                        <span className={`absolute inset-y-0 left-0 rounded-full ${status === "low" ? "bg-[#8a6710]" : status === "full" ? "bg-[#0d412e]" : "bg-[#1d6a45]"}`} style={{ width: `${barWidth}%` }} />
                        {capacityPosition !== null && <span aria-hidden="true" className="absolute -bottom-0.5 -top-0.5 w-0.5 bg-[#6f5412]" style={{ left: `${capacityPosition}%` }} />}
                        <span aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-white px-1 text-xs font-bold text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white" style={{ left: `${labelPosition}%`, transform: "translate(0.35rem, -50%)" }}>
                          {section.students}
                        </span>
                      </span>
                      <span className={`min-w-10 text-right text-xs font-semibold ${status === "low" ? "text-[#765b16] dark:text-amber-300" : status === "full" ? "text-[#0d412e] dark:text-emerald-300" : status === "normal" ? "text-[#1d6a45] dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"}`}>
                        {section.capacity === null ? <span className="block">No cap</span> : <><span className="block">/ {section.capacity}</span><span className="block">{status}</span></>}
                      </span>
                      <span id={`section-tooltip-${section.sectionId}`} role="tooltip" className="pointer-events-none absolute bottom-full left-1 z-20 mb-1 max-w-[min(90vw,20rem)] rounded-lg border border-[#d7e4db] bg-white px-3 py-2 text-xs font-medium leading-5 text-slate-800 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                        <span className="block font-bold">{section.label}</span>
                        Adviser: {section.adviserName ?? "Not assigned"} · Enrolled: {section.students} · Capacity: {section.capacity ?? "Not set"}
                        {status && <span className="block">Capacity status: {status}</span>}
                        <span className="block">{section.classOfferingCount} class offerings</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
              <span>Capacity: count / configured limit</span>
              <span>Low: &lt;50%</span><span>Normal: 50–99%</span><span>Full: ≥100%</span>
            </p>
          </div>
        )
      ) : (
        <div className="mt-3 max-h-60 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[560px] text-left text-xs">
            <caption className="sr-only">Section sizes and capacity data</caption>
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <tr>
                {([
                  ["name", "Section"],
                  ["gradeLevel", "Grade"],
                  ["adviserName", "Adviser"],
                  ["students", "Enrolled"],
                  ["capacity", "Capacity"],
                ] as const).map(([key, label]) => (
                  <th key={key} scope="col" aria-sort={tableSort === key ? (tableSortDescending ? "descending" : "ascending") : undefined} className="px-3 py-2 font-semibold">
                    <button type="button" onClick={() => setSort(key)} className="rounded text-left underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#1d6a45]">
                      {label}{tableSort === key ? (tableSortDescending ? " ↓" : " ↑") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {tableSections.map((section) => (
                <tr key={section.sectionId} className="text-slate-700 dark:text-slate-200">
                  <td className="px-3 py-2">
                    <Link href={`/admin/sections/${encodeURIComponent(section.sectionId)}`} aria-label={`${section.label}: ${section.students} ${section.students === 1 ? "student" : "students"}`} className="rounded font-semibold text-[#1d6a45] hover:underline focus-visible:outline-2 focus-visible:outline-[#1d6a45] dark:text-[#dfeee4]">
                      {shortenSectionLabel(section.gradeLevel, section.name)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{section.gradeLevel}</td>
                  <td className="px-3 py-2">{section.adviserName ?? <span className="font-semibold text-[#765b16] dark:text-amber-300">Not assigned</span>}</td>
                  <td className="px-3 py-2">{section.students}</td>
                  <td className="px-3 py-2">{section.capacity === null ? "Not set" : section.capacity}</td>
                </tr>
              ))}
              {tableSections.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-600 dark:text-slate-300">{data.length ? "No sections are configured for this school year." : "No section data available."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const GRADE_BUCKETS: { key: keyof TeacherDashboardData["gradeDistribution"]; label: string }[] = [
  { key: "90-100", label: "90-100" },
  { key: "85-89", label: "85-89" },
  { key: "80-84", label: "80-84" },
  { key: "75-79", label: "75-79" },
  { key: "below75", label: "Below 75" },
];

export function GradeDistributionChart({ data }: Readonly<{ data: TeacherDashboardData["gradeDistribution"] }>) {
  const rows = GRADE_BUCKETS.map((bucket) => ({ range: bucket.label, count: data[bucket.key] }));
  return (
    <ChartCard
      title="Grade distribution (current term)"
      description="Counts of grades across your classes; no student ranking"
      columns={[{ key: "range", label: "Score range" }, { key: "count", label: "Entries" }]}
      rows={rows}
      rowHref={() => "/teacher/grades"}
      action={<Link href="/teacher/grades" className="text-xs font-semibold text-[#1d6a45] hover:underline dark:text-[#dfeee4]">View grades</Link>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 18, right: 12, left: -15, bottom: 0 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="range" tick={{ fill: axisColor, fontSize: 10 }} />
          <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Grade entries" radius={[5, 5, 0, 0]}>
            {rows.map((row, index) => <Cell key={row.range} fill={COLORS[index]} />)}
            <LabelList dataKey="count" position="top" fill={axisColor} fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
