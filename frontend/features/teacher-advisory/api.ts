import { apiFetch } from "../../lib/api";

export interface TeacherAdvisee {
  id: string;
  studentNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  status: "ENROLLED";
  attendance: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    rate: number | null;
  };
  needsAttendanceFollowUp: boolean;
  recentGrades: Array<{
    classOfferingId: string;
    teacherAssigned: boolean;
    subject: { id: string; code: string; name: string };
    score: number | null;
  }>;
}

export interface TeacherAdviseesResponse {
  schoolYear: { id: string; name: string } | null;
  section: { id: string; name: string; gradeLevel: number } | null;
  currentTerm: { id: string; name: string } | null;
  attendancePeriod: { from: string; to: string } | null;
  recentGradeTerm: { id: string; name: string } | null;
  students: TeacherAdvisee[];
}

export function fetchMyAdvisees() {
  return apiFetch<TeacherAdviseesResponse>("/api/me/advisory/students");
}
