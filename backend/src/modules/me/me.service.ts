import { AttendanceStatus, EnrollmentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { getTeacherIdForUser } from "../../services/access.service.js";
import { AppError } from "../../utils/AppError.js";
import { formatDateString, parseDateString } from "../../utils/dates.js";
import { calculateAttendanceRate } from "../attendance/attendance.rules.js";
import { getCurrentContext } from "../dashboard/dashboard.helpers.js";
import { myClassesQuerySchema } from "./me.schema.js";

async function resolveSchoolYearId(schoolYearId?: string): Promise<string> {
  if (schoolYearId) {
    const year = await prisma.schoolYear.findUnique({ where: { id: schoolYearId }, select: { id: true } });
    if (!year) throw new AppError("School year not found", 404);
    return year.id;
  }
  const current = await prisma.schoolYear.findFirst({ where: { isCurrent: true }, select: { id: true } });
  if (!current) throw new AppError("No current school year is configured", 404, "NO_CURRENT_SCHOOL_YEAR");
  return current.id;
}

export async function getMyClasses(userId: string, rawQuery: unknown) {
  const parsed = myClassesQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten().fieldErrors });
  }
  const [teacherId, schoolYearId] = await Promise.all([
    getTeacherIdForUser(userId),
    resolveSchoolYearId(parsed.data.schoolYearId),
  ]);
  const [classOfferings, advisedSection] = await Promise.all([
    prisma.classOffering.findMany({
      where: { teacherId, schoolYearId },
      orderBy: [{ section: { gradeLevel: "asc" } }, { section: { name: "asc" } }, { subject: { name: "asc" } }],
      include: {
        subject: { select: { id: true, code: true, name: true, gradeLevel: true } },
        section: {
          select: {
            id: true,
            name: true,
            gradeLevel: true,
            _count: {
              select: {
                enrollments: {
                  where: { schoolYearId, status: EnrollmentStatus.ENROLLED },
                },
              },
            },
          },
        },
      },
    }),
    prisma.section.findFirst({
      where: { adviserId: teacherId, schoolYearId },
      select: { id: true, name: true, gradeLevel: true, schoolYear: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    data: classOfferings.map(({ section, ...offering }) => ({
      ...offering,
      section: { id: section.id, name: section.name, gradeLevel: section.gradeLevel },
      enrolledStudentCount: section._count.enrollments,
    })),
    advisedSection,
  };
}

export async function getMyAdvisoryStudents(userId: string) {
  const [teacherId, context] = await Promise.all([
    getTeacherIdForUser(userId),
    getCurrentContext(),
  ]);
  const schoolYear = context.schoolYear;
  const currentTerm = context.currentTerm;
  const recentGradeTerm = schoolYear?.terms
    .filter((term) => term.gradesReleasedAt !== null)
    .at(-1) ?? null;
  const attendancePeriod = currentTerm
    ? {
        from: formatDateString(currentTerm.startDate),
        to: formatDateString(currentTerm.endDate),
      }
    : null;

  const section = schoolYear
    ? await prisma.section.findFirst({
        where: { adviserId: teacherId, schoolYearId: schoolYear.id },
        select: { id: true, name: true, gradeLevel: true },
      })
    : null;

  if (!schoolYear || !section) {
    return {
      schoolYear: schoolYear ? { id: schoolYear.id, name: schoolYear.name } : null,
      section,
      currentTerm: currentTerm ? { id: currentTerm.id, name: currentTerm.name } : null,
      attendancePeriod,
      recentGradeTerm: recentGradeTerm ? { id: recentGradeTerm.id, name: recentGradeTerm.name } : null,
      students: [],
    };
  }

  const [students, offerings] = await Promise.all([
    prisma.student.findMany({
      where: {
        enrollments: {
          some: {
            sectionId: section.id,
            schoolYearId: schoolYear.id,
            status: EnrollmentStatus.ENROLLED,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true },
    }),
    prisma.classOffering.findMany({
      where: { sectionId: section.id, schoolYearId: schoolYear.id },
      select: {
        id: true,
        teacherId: true,
        subject: { select: { id: true, code: true, name: true } },
      },
    }),
  ]);
  const studentIds = students.map(({ id }) => id);
  const offeringIds = offerings.map(({ id }) => id);
  const attendanceDateRange = currentTerm
    ? {
        gte: parseDateString(formatDateString(currentTerm.startDate)),
        lte: parseDateString(formatDateString(currentTerm.endDate)),
      }
    : undefined;
  const [attendanceGroups, grades] = await Promise.all([
    attendanceDateRange && studentIds.length && offeringIds.length
      ? prisma.attendance.groupBy({
          by: ["studentId", "status"],
          where: {
            studentId: { in: studentIds },
            classOfferingId: { in: offeringIds },
            date: attendanceDateRange,
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    recentGradeTerm && studentIds.length && offeringIds.length
      ? prisma.grade.findMany({
          where: {
            studentId: { in: studentIds },
            classOfferingId: { in: offeringIds },
            termId: recentGradeTerm.id,
          },
          select: { studentId: true, classOfferingId: true, score: true },
        })
      : Promise.resolve([]),
  ]);

  const attendanceByStudent = new Map<string, {
    present: number;
    absent: number;
    late: number;
    excused: number;
  }>();
  for (const group of attendanceGroups) {
    const counts = attendanceByStudent.get(group.studentId) ?? {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };
    switch (group.status) {
      case AttendanceStatus.PRESENT: counts.present = group._count._all; break;
      case AttendanceStatus.ABSENT: counts.absent = group._count._all; break;
      case AttendanceStatus.LATE: counts.late = group._count._all; break;
      case AttendanceStatus.EXCUSED: counts.excused = group._count._all; break;
    }
    attendanceByStudent.set(group.studentId, counts);
  }

  const offeringsById = new Map(offerings.map((offering) => [offering.id, offering]));
  const gradesByStudent = new Map<string, typeof grades>();
  for (const grade of grades) {
    const studentGrades = gradesByStudent.get(grade.studentId) ?? [];
    studentGrades.push(grade);
    gradesByStudent.set(grade.studentId, studentGrades);
  }

  return {
    schoolYear: { id: schoolYear.id, name: schoolYear.name },
    section,
    currentTerm: currentTerm ? { id: currentTerm.id, name: currentTerm.name } : null,
    attendancePeriod,
    recentGradeTerm: recentGradeTerm ? { id: recentGradeTerm.id, name: recentGradeTerm.name } : null,
    students: students.map((student) => {
      const attendance = attendanceByStudent.get(student.id) ?? {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };
      const attendanceTotal = attendance.present + attendance.absent + attendance.late + attendance.excused;
      const countableAttendance = attendance.present + attendance.absent + attendance.late;
      const attendanceRate = calculateAttendanceRate(attendance);
      const recentGrades = (gradesByStudent.get(student.id) ?? []).flatMap((grade) => {
        const offering = offeringsById.get(grade.classOfferingId);
        if (!offering) return [];
        return [{
          classOfferingId: offering.id,
          teacherAssigned: offering.teacherId === teacherId,
          subject: offering.subject,
          score: grade.score === null ? null : Number(grade.score),
        }];
      });

      return {
        ...student,
        status: EnrollmentStatus.ENROLLED,
        attendance: {
          ...attendance,
          total: attendanceTotal,
          rate: attendanceRate,
        },
        needsAttendanceFollowUp: countableAttendance >= 5 && attendanceRate !== null && attendanceRate < 90,
        recentGrades,
      };
    }),
  };
}

export async function getMyEnrollment(userId: string) {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!student) throw new AppError("Student profile not found", 404, "STUDENT_PROFILE_NOT_FOUND");
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });
  if (!schoolYear) return { enrollment: null, classOfferings: [] };

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId: student.id,
      schoolYearId: schoolYear.id,
      status: EnrollmentStatus.ENROLLED,
    },
    include: {
      section: {
        include: {
          adviser: {
            select: { id: true, firstName: true, middleName: true, lastName: true },
          },
        },
      },
      schoolYear: { select: { id: true, name: true, isCurrent: true } },
    },
  });
  if (!enrollment) return { enrollment: null, classOfferings: [] };
  if (!enrollment.section) return { enrollment, classOfferings: [] };
  const classOfferings = await prisma.classOffering.findMany({
    where: { sectionId: enrollment.section.id, schoolYearId: schoolYear.id },
    orderBy: { subject: { name: "asc" } },
    include: {
      subject: { select: { id: true, code: true, name: true, gradeLevel: true } },
      teacher: { select: { id: true, firstName: true, middleName: true, lastName: true } },
    },
  });
  return { enrollment, classOfferings };
}

export async function getMyProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      passwordChangedAt: true,
      student: {
        select: {
          studentNo: true,
          firstName: true,
          middleName: true,
          lastName: true,
          enrollments: {
            where: {
              status: EnrollmentStatus.ENROLLED,
              schoolYear: { isCurrent: true },
            },
            take: 1,
            select: {
              section: { select: { name: true, gradeLevel: true } },
            },
          },
        },
      },
      teacher: {
        select: {
          employeeNo: true,
          firstName: true,
          middleName: true,
          lastName: true,
          department: true,
          contactNo: true,
        },
      },
    },
  });
  if (!user) throw new AppError("Not authenticated", 401);

  const fullName = (person: { firstName: string; middleName: string | null; lastName: string }) =>
    [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");
  let person: unknown = null;
  if (user.student) {
    const section = user.student.enrollments[0]?.section;
    person = {
      type: "STUDENT",
      studentNo: user.student.studentNo,
      fullName: fullName(user.student),
      currentSection: section ? `Grade ${section.gradeLevel} - ${section.name}` : null,
    };
  } else if (user.teacher) {
    person = {
      type: "TEACHER",
      employeeNo: user.teacher.employeeNo,
      fullName: fullName(user.teacher),
      department: user.teacher.department,
      contactNo: user.teacher.contactNo,
    };
  }
  return {
    user: {
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      passwordChangedAt: user.passwordChangedAt,
    },
    person,
  };
}
