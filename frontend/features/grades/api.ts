import { apiFetch } from "../../lib/api";
import type { ClassGradeSheet, StudentGradesResponse, TermGradeCompleteness } from "./types";

interface GradeSheetResponse {
  classOffering: Pick<ClassGradeSheet, "subject" | "section" | "teacher"> & { id: string };
  terms: ClassGradeSheet["terms"];
  roster: Array<{
    id: string;
    studentNo: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    terms: Array<{ termId: string; score: number | null; remarks: string | null }>;
    finalGrade: number | null;
    descriptor: string | null;
    passing: boolean | null;
  }>;
  editableTermIds: string[];
}

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.toString();
}

export function fetchClassGradeSheet(classOfferingId: string) {
  return apiFetch<GradeSheetResponse>(`/api/class-offerings/${encodeURIComponent(classOfferingId)}/grades`).then((response) => ({
    classOfferingId: response.classOffering.id,
    subject: response.classOffering.subject,
    section: response.classOffering.section,
    teacher: response.classOffering.teacher,
    terms: response.terms,
    roster: response.roster.map(({ id, terms, ...student }) => ({
      studentId: id,
      ...student,
      scores: Object.fromEntries(terms.map(({ termId, score }) => [termId, score])),
      remarks: Object.fromEntries(terms.map(({ termId, remarks }) => [termId, remarks])),
    })),
    editableTermIds: response.editableTermIds,
  }));
}

export function saveClassGrades(classOfferingId: string, input: {
  termId: string;
  records: Array<{ studentId: string; score: number | null; remarks?: string }>;
}) {
  return apiFetch(`/api/class-offerings/${encodeURIComponent(classOfferingId)}/grades`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function fetchMyGrades(params: { schoolYearId?: string } = {}) {
  return apiFetch<{
    schoolYearId: string;
    schoolYear: { id: string; name: string };
    enrollment: {
      section: { id: string; name: string; gradeLevel: number };
      schoolYear: { id: string; name: string };
    } | null;
    generalAverage: number | null;
    subjects: Array<{
      classOfferingId: string;
      subject: { id: string; code: string; name: string };
      terms: Array<{ termId: string; name: string; order: number; locked: boolean; released: boolean; score: number | null }>;
      finalGrade: number | null;
      descriptor: string | null;
      passing: boolean | null;
    }>;
  }>(`/api/me/grades?${queryString(params)}`).then((response): StudentGradesResponse => ({
    schoolYear: response.schoolYear,
    enrollment: response.enrollment ? { section: response.enrollment.section } : null,
    generalAverage: response.generalAverage,
    subjects: response.subjects.map((subject) => ({
      id: subject.subject.id,
      code: subject.subject.code,
      name: subject.subject.name,
      sectionName: response.enrollment?.section.name ?? "",
      terms: subject.terms.map(({ termId, ...term }) => ({ id: termId, ...term })),
      finalGrade: subject.finalGrade,
      descriptor: subject.descriptor,
      passing: subject.passing,
    })),
  }));
}

export function fetchTermGradeCompleteness(schoolYearId: string, termId: string) {
  return apiFetch<TermGradeCompleteness>(
    `/api/school-years/${encodeURIComponent(schoolYearId)}/terms/${encodeURIComponent(termId)}/grade-completeness`,
  );
}

export function setTermLocked(schoolYearId: string, termId: string, locked: boolean, reason?: string) {
  return apiFetch(`/api/school-years/${encodeURIComponent(schoolYearId)}/terms/${encodeURIComponent(termId)}/lock`, {
    method: "PATCH",
    body: JSON.stringify({ locked, reason }),
  });
}

export function setTermReleased(schoolYearId: string, termId: string, released: boolean, reason?: string) {
  return apiFetch(`/api/school-years/${encodeURIComponent(schoolYearId)}/terms/${encodeURIComponent(termId)}/release`, {
    method: "PATCH",
    body: JSON.stringify({ released, reason }),
  });
}
