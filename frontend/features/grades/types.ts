export type GradeValue = number | null;

export interface GradeTermSummary {
  id: string;
  name: string;
  order: number;
  gradesLocked: boolean;
  released: boolean;
}

export interface GradeRow {
  studentId: string;
  studentNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  scores: Record<string, GradeValue>;
  remarks: Record<string, string | null>;
  finalGrade: number | null;
  descriptor: string | null;
  passing: boolean | null;
}

export interface ClassGradeSheet {
  classOfferingId: string;
  subject: { id: string; code: string; name: string };
  section: { id: string; name: string; gradeLevel: number };
  teacher: { id: string; firstName: string; lastName: string };
  terms: GradeTermSummary[];
  roster: GradeRow[];
  editableTermIds: string[];
}

export interface StudentGradeTerm {
  id: string;
  name: string;
  order: number;
  locked: boolean;
  released: boolean;
  score: number | null;
}

export interface TermGradeCompleteness {
  termId: string;
  offeringsWithMissingGrades: number;
  missingGradeCount: number;
  classes: Array<{
    classOfferingId: string;
    section: { name: string; gradeLevel: number };
    subject: { code: string; name: string };
    teacher: { firstName: string; middleName: string | null; lastName: string } | null;
    enrolledCount: number;
    gradedCount: number;
    missingCount: number;
  }>;
}

export interface StudentGradeSubject {
  id: string;
  code: string;
  name: string;
  sectionName: string;
  terms: StudentGradeTerm[];
  finalGrade: number | null;
  descriptor: string | null;
  passing: boolean | null;
}

export interface StudentGradesResponse {
  schoolYear: { id: string; name: string };
  enrollment: { section: { id: string; name: string; gradeLevel: number } } | null;
  generalAverage: number | null;
  subjects: StudentGradeSubject[];
}
