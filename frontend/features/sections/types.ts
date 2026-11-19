import type { SeniorHighStrand } from "../enrollment/types";

export interface Section {
  id: string; name: string; gradeLevel: number; strand: SeniorHighStrand | null; capacity: number | null; schoolYearId: string; adviserId: string | null;
  schoolYear?: { id: string; name: string; isCurrent: boolean };
  adviser: { id: string; employeeNo?: string; firstName: string; middleName?: string | null; lastName: string; isActive?: boolean } | null;
  _count?: { enrollments: number; classOfferings: number };
}
export interface SectionParams { page: number; pageSize: number; search?: string; schoolYearId?: string; gradeLevel?: number; strand?: SeniorHighStrand }
export interface SectionPage { data: Section[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }
export interface SectionInput { schoolYearId?: string; gradeLevel: number; name: string; strand?: SeniorHighStrand | null; capacity?: number | null; adviserId?: string | null }
export interface SectionDetail extends Section {
  enrollments: Array<{ id: string; status: string; student: { id: string; studentNo: string; firstName: string; middleName: string | null; lastName: string } }>;
  classOfferings: Array<{
    id: string;
    subjectId: string;
    sectionId: string;
    teacherId: string;
    schoolYearId: string;
    subject: { id: string; code: string; name: string; gradeLevel: number };
    teacher: { id: string; employeeNo: string; firstName: string; middleName: string | null; lastName: string };
  }>;
}
