import {
  AttendanceStatus,
  EnrollmentStatus,
  Prisma,
  Role,
  StudentStatus,
  StudentSupportAlertRule,
} from "@prisma/client";
import type { Request } from "express";
import { z } from "zod";
import { audit } from "../../audit.js";
import { prisma } from "../../lib/prisma.js";
import { getTeacherIdForUser } from "../../services/access.service.js";
import { AppError } from "../../utils/AppError.js";
import { PASSING_GRADE } from "../../utils/grading.js";
import { parseDateString, todayInManila } from "../../utils/dates.js";
import { updateSupportAlertSchema } from "./support-alert.schema.js";

type Signal = {
  studentId: string;
  rule: StudentSupportAlertRule;
  summary: string;
  evidence: Prisma.InputJsonObject;
};

function isActiveEvidence(value: Prisma.JsonValue): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    "active" in value && value.active === true;
}

function previousDays(days: number) {
  const date = parseDateString(todayInManila());
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

async function getScopedStudents(user: { id: string; role: Role }) {
  if (user.role !== Role.ADMIN && user.role !== Role.TEACHER) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });
  if (!schoolYear) throw new AppError("No current school year is configured", 404, "NO_CURRENT_SCHOOL_YEAR");
  const teacherId = user.role === Role.TEACHER ? await getTeacherIdForUser(user.id) : undefined;
  const enrollmentScope: Prisma.StudentWhereInput = {
    status: StudentStatus.ACTIVE,
    enrollments: {
      some: {
        schoolYearId: schoolYear.id,
        status: EnrollmentStatus.ENROLLED,
        ...(teacherId ? { section: { is: { adviserId: teacherId } } } : {}),
      },
    },
  };
  const students = await prisma.student.findMany({
    where: enrollmentScope,
    select: { id: true, studentNo: true, firstName: true, lastName: true },
  });
  return { schoolYearId: schoolYear.id, students };
}

export async function listStudentSupportAlerts(user: { id: string; role: Role }) {
  const { schoolYearId, students } = await getScopedStudents(user);
  const studentIds = students.map(({ id }) => id);
  if (!studentIds.length) return { schoolYearId, data: [] };
  const data = await prisma.studentSupportAlert.findMany({
    where: { schoolYearId, studentId: { in: studentIds } },
    include: {
      student: { select: { id: true, studentNo: true, firstName: true, lastName: true } },
      updatedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  return {
    schoolYearId,
    data: data.map((alert) => ({ ...alert, conditionActive: isActiveEvidence(alert.evidence) })),
  };
}

export async function refreshStudentSupportAlerts(user: { id: string; role: Role }) {
  const { schoolYearId, students } = await getScopedStudents(user);
  const studentIds = students.map(({ id }) => id);
  if (!studentIds.length) return { schoolYearId, data: [] };

  const [attendance, grades] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["studentId", "status"],
      where: {
        studentId: { in: studentIds },
        date: { gte: previousDays(29) },
        classOffering: { schoolYearId },
      },
      _count: { _all: true },
    }),
    prisma.grade.findMany({
      where: {
        studentId: { in: studentIds },
        term: { schoolYearId, gradesReleasedAt: { not: null } },
      },
      select: {
        studentId: true,
        score: true,
        term: { select: { termNumber: true, name: true } },
      },
    }),
  ]);
  const signals = new Map<string, Signal>();
  const attendanceByStudent = new Map<string, Record<string, number>>();
  for (const group of attendance) {
    const counts = attendanceByStudent.get(group.studentId) ?? {};
    counts[group.status] = group._count._all;
    attendanceByStudent.set(group.studentId, counts);
  }
  for (const student of students) {
    const counts = attendanceByStudent.get(student.id) ?? {};
    const present = counts[AttendanceStatus.PRESENT] ?? 0;
    const late = counts[AttendanceStatus.LATE] ?? 0;
    const absent = counts[AttendanceStatus.ABSENT] ?? 0;
    const total = present + late + absent;
    const rate = total ? Math.round(((present + late) / total) * 1000) / 10 : null;
    if (absent >= 3 || (rate !== null && rate < 80)) {
      const key = `${student.id}:${StudentSupportAlertRule.ATTENDANCE}`;
      signals.set(key, {
        studentId: student.id,
        rule: StudentSupportAlertRule.ATTENDANCE,
        summary: "Attendance needs follow-up",
        evidence: { active: true, present, late, absent, rate, windowDays: 30 },
      });
    }
  }

  const gradeAverages = new Map<string, Map<number, { sum: number; count: number; name: string }>>();
  for (const grade of grades) {
    const byTerm = gradeAverages.get(grade.studentId) ?? new Map();
    const average = byTerm.get(grade.term.termNumber) ?? { sum: 0, count: 0, name: grade.term.name };
    average.sum += Number(grade.score);
    average.count += 1;
    byTerm.set(grade.term.termNumber, average);
    gradeAverages.set(grade.studentId, byTerm);
  }
  for (const student of students) {
    const terms = [...(gradeAverages.get(student.id)?.entries() ?? [])]
      .sort(([left], [right]) => left - right)
      .map(([termNumber, value]) => ({ termNumber, ...value, average: value.sum / value.count }));
    const latest = terms.at(-1);
    const previous = terms.at(-2);
    if (latest && latest.average < PASSING_GRADE) {
      const key = `${student.id}:${StudentSupportAlertRule.LOW_GRADE}`;
      signals.set(key, {
        studentId: student.id,
        rule: StudentSupportAlertRule.LOW_GRADE,
        summary: "Latest released term average is below passing",
        evidence: { active: true, term: latest.name, average: Math.round(latest.average * 10) / 10, passingGrade: PASSING_GRADE },
      });
    }
    if (latest && previous && previous.average - latest.average >= 5) {
      const key = `${student.id}:${StudentSupportAlertRule.DECLINING_GRADE}`;
      signals.set(key, {
        studentId: student.id,
        rule: StudentSupportAlertRule.DECLINING_GRADE,
        summary: "Term average declined by at least 5 points",
        evidence: {
          active: true,
          previousTerm: previous.name,
          previousAverage: Math.round(previous.average * 10) / 10,
          latestTerm: latest.name,
          latestAverage: Math.round(latest.average * 10) / 10,
        },
      });
    }
  }

  const existing = await prisma.studentSupportAlert.findMany({
    where: { schoolYearId, studentId: { in: studentIds } },
    select: { id: true, studentId: true, rule: true, status: true, evidence: true },
  });
  const existingByKey = new Map(existing.map((alert) => [`${alert.studentId}:${alert.rule}`, alert]));
  await prisma.$transaction(async (transaction) => {
    for (const signal of signals.values()) {
      const key = `${signal.studentId}:${signal.rule}`;
      const previousAlert = existingByKey.get(key);
      const shouldRestartResolved = previousAlert?.status === "RESOLVED" && !isActiveEvidence(previousAlert.evidence);
      await transaction.studentSupportAlert.upsert({
        where: {
          studentId_schoolYearId_rule: {
            studentId: signal.studentId,
            schoolYearId,
            rule: signal.rule,
          },
        },
        create: {
          ...signal,
          schoolYearId,
        },
        update: {
          summary: signal.summary,
          evidence: signal.evidence,
          ...(shouldRestartResolved ? { status: "NOT_STARTED" } : {}),
        },
      });
    }
    for (const alert of existing) {
      if (signals.has(`${alert.studentId}:${alert.rule}`) || !isActiveEvidence(alert.evidence)) continue;
      const evidence = alert.evidence;
      await transaction.studentSupportAlert.update({
        where: { id: alert.id },
        data: {
          evidence: {
            ...(typeof evidence === "object" && evidence !== null && !Array.isArray(evidence) ? evidence : {}),
            active: false,
          },
        },
      });
    }
  });

  const data = await prisma.studentSupportAlert.findMany({
    where: { schoolYearId, studentId: { in: studentIds } },
    include: {
      student: { select: { id: true, studentNo: true, firstName: true, lastName: true } },
      updatedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  return {
    schoolYearId,
    data: data.map((alert) => ({ ...alert, conditionActive: isActiveEvidence(alert.evidence) })),
  };
}

export async function updateStudentSupportAlert(
  id: string,
  rawInput: unknown,
  user: { id: string; role: Role },
  request: Request,
) {
  if (user.role !== Role.ADMIN && user.role !== Role.TEACHER) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
  const parsed = updateSupportAlertSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", { errors: parsed.error.flatten().fieldErrors });
  }
  const alert = await prisma.studentSupportAlert.findUnique({
    where: { id },
    select: { id: true, studentId: true, schoolYearId: true, status: true },
  });
  if (!alert) throw new AppError("Support alert not found", 404);
  if (user.role === Role.TEACHER) {
    const teacherId = await getTeacherIdForUser(user.id);
    const isAdviser = await prisma.enrollment.findFirst({
      where: {
        studentId: alert.studentId,
        schoolYearId: alert.schoolYearId,
        status: EnrollmentStatus.ENROLLED,
        section: { is: { adviserId: teacherId } },
      },
      select: { id: true },
    });
    if (!isAdviser) throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.studentSupportAlert.update({
      where: { id },
      data: { ...parsed.data, updatedById: user.id },
    });
    await audit(transaction, request, {
      action: "SUPPORT_ALERT_UPDATED",
      entityType: "StudentSupportAlert",
      entityId: id,
      studentId: alert.studentId,
      before: { status: alert.status },
      after: parsed.data,
    });
    return updated;
  });
}
