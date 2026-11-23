import { EnrollmentStatus, Prisma, StudentStatus } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { audit, auditStudentViews } from "../../audit.js";
import { AppError } from "../../utils/AppError.js";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination.js";
import { invalidateAdminDashboardCache } from "../dashboard/dashboard.helpers.js";
import {
  listEnrollmentsQuerySchema,
  unassignedStudentsQuerySchema,
  type BulkEnrollInput,
  type CreateEnrollmentInput,
  type TransferEnrollmentInput,
  type UpdateEnrollmentStatusInput,
} from "./enrollment.schema.js";

type EnrollmentTransaction = Prisma.TransactionClient;

async function lockSectionEnrollment(transaction: EnrollmentTransaction, sectionId: string) {
  await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sectionId})::bigint)::text`;
}

async function assertSectionHasCapacity(transaction: EnrollmentTransaction, sectionId: string) {
  await lockSectionEnrollment(transaction, sectionId);
  const section = await transaction.section.findUnique({
    where: { id: sectionId },
    select: { id: true, name: true, capacity: true },
  });
  if (!section) throw new AppError("Section not found", 404);
  if (section.capacity === null) return;
  const activeCount = await transaction.enrollment.count({
    where: { sectionId, status: EnrollmentStatus.ENROLLED },
  });
  if (activeCount >= section.capacity) {
    throw new AppError(`${section.name} has reached its ${section.capacity}-student capacity`, 409, "SECTION_FULL", {
      capacity: section.capacity,
      enrolled: activeCount,
    });
  }
}

function isKnownError(error: unknown, code: string): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function throwEnrollmentError(error: unknown): never {
  if (isKnownError(error, "P2025")) throw new AppError("Enrollment not found", 404);
  if (isKnownError(error, "P2002")) {
    throw new AppError("The student already has an enrollment for this school year", 409, "ALREADY_ENROLLED");
  }
  if (isKnownError(error, "P2003")) throw new AppError("The referenced student or section does not exist", 400, "INVALID_REFERENCE");
  throw error;
}

function parseQuery<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } } }, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, {
      errors: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

async function resolveSchoolYearId(schoolYearId?: string, transaction = prisma): Promise<string> {
  if (schoolYearId) {
    const schoolYear = await transaction.schoolYear.findUnique({ where: { id: schoolYearId }, select: { id: true } });
    if (!schoolYear) throw new AppError("School year not found", 404);
    return schoolYear.id;
  }
  const current = await transaction.schoolYear.findFirst({ where: { isCurrent: true }, select: { id: true } });
  if (!current) throw new AppError("No current school year is configured", 404, "NO_CURRENT_SCHOOL_YEAR");
  return current.id;
}

async function enrollOne(
  transaction: EnrollmentTransaction,
  studentId: string,
  section: { id: string; name: string; schoolYearId: string },
) {
  const student = await transaction.student.findUnique({
    where: { id: studentId },
    select: { id: true, status: true },
  });
  if (!student) throw new AppError("Student not found", 404, "STUDENT_NOT_FOUND");
  if (student.status !== StudentStatus.ACTIVE) {
    throw new AppError("Only active students can be enrolled", 400, "STUDENT_NOT_ACTIVE");
  }

  const existing = await transaction.enrollment.findUnique({
    where: { studentId_schoolYearId: { studentId, schoolYearId: section.schoolYearId } },
    include: { section: { select: { name: true } } },
  });
  if (existing?.status === EnrollmentStatus.ENROLLED) {
    const currentSectionName = existing.section?.name ?? "an unassigned section";
    throw new AppError(
      `Student is already enrolled in ${currentSectionName}`,
      409,
      "ALREADY_ENROLLED",
      { currentSectionName },
    );
  }
  if (existing?.status === EnrollmentStatus.COMPLETED) {
    throw new AppError("The student's enrollment for this school year is already completed", 409, "ALREADY_COMPLETED");
  }
  await assertSectionHasCapacity(transaction, section.id);
  if (existing) {
    return transaction.enrollment.update({
      where: { id: existing.id },
      data: { sectionId: section.id, status: EnrollmentStatus.ENROLLED, enrolledAt: new Date() },
      include: {
        student: { select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true } },
        section: { select: { id: true, name: true, gradeLevel: true } },
        schoolYear: { select: { id: true, name: true } },
      },
    });
  }
  return transaction.enrollment.create({
    data: { studentId, sectionId: section.id, schoolYearId: section.schoolYearId },
    include: {
      student: { select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true } },
      section: { select: { id: true, name: true, gradeLevel: true } },
      schoolYear: { select: { id: true, name: true } },
    },
  });
}

async function getSectionForEnrollment(sectionId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, name: true, schoolYearId: true },
  });
  if (!section) throw new AppError("Section not found", 404);
  return section;
}

export async function createEnrollment(input: CreateEnrollmentInput, request?: Request) {
  const section = await getSectionForEnrollment(input.sectionId);
  try {
    const enrollment = await prisma.$transaction(async (transaction) => {
      const result = await enrollOne(transaction, input.studentId, section);
      if (request) {
        await audit(transaction, request, {
          action: "ENROLL",
          entityType: "Enrollment",
          entityId: result.id,
          studentId: input.studentId,
          after: { studentId: input.studentId, sectionId: section.id, schoolYearId: section.schoolYearId, status: result.status },
        });
      }
      return result;
    });
    invalidateAdminDashboardCache();
    return enrollment;
  } catch (error) {
    if (isKnownError(error, "P2002")) {
      const current = await prisma.enrollment.findUnique({
        where: { studentId_schoolYearId: { studentId: input.studentId, schoolYearId: section.schoolYearId } },
        include: { section: { select: { name: true } } },
      });
      const currentSectionName = current?.section?.name ?? "an unassigned section";
      throw new AppError(
        `Student is already enrolled in ${currentSectionName}`,
        409,
        "ALREADY_ENROLLED",
        { currentSectionName },
      );
    }
    throwEnrollmentError(error);
  }
}

export async function bulkEnroll(
  input: BulkEnrollInput,
  request?: Request,
) {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      await lockSectionEnrollment(transaction, input.sectionId);
      const section = await transaction.section.findUnique({
        where: { id: input.sectionId },
        select: { id: true, name: true, schoolYearId: true, capacity: true },
      });
      if (!section) throw new AppError("Section not found", 404);

      const students = await transaction.student.findMany({
        where: { id: { in: input.studentIds } },
        select: { id: true, status: true },
      });
      const foundStudentIds = new Set(students.map((student) => student.id));
      const missingStudentIds = input.studentIds.filter((studentId) => !foundStudentIds.has(studentId));
      if (missingStudentIds.length) {
        throw new AppError("One or more selected students could not be found", 404, "STUDENT_NOT_FOUND", {
          studentIds: missingStudentIds,
        });
      }
      if (students.some((student) => student.status !== StudentStatus.ACTIVE)) {
        throw new AppError("Only active students can be enrolled", 409, "STUDENT_NOT_ACTIVE");
      }

      const existingEnrollments = await transaction.enrollment.findMany({
        where: { studentId: { in: input.studentIds }, schoolYearId: section.schoolYearId },
        select: { id: true, studentId: true, status: true },
      });
      if (existingEnrollments.some((enrollment) => enrollment.status === EnrollmentStatus.ENROLLED)) {
        throw new AppError(
          "One or more selected students are already enrolled for this school year",
          409,
          "ALREADY_ENROLLED",
        );
      }
      if (existingEnrollments.some((enrollment) => enrollment.status === EnrollmentStatus.COMPLETED)) {
        throw new AppError(
          "One or more selected students already completed enrollment for this school year",
          409,
          "ALREADY_COMPLETED",
        );
      }

      const enrolledCount = await transaction.enrollment.count({
        where: { sectionId: section.id, status: EnrollmentStatus.ENROLLED },
      });
      if (section.capacity !== null && enrolledCount + input.studentIds.length > section.capacity) {
        throw new AppError(
          `${section.name} does not have capacity for all selected students`,
          409,
          "SECTION_FULL",
          { capacity: section.capacity, enrolled: enrolledCount, requested: input.studentIds.length },
        );
      }

      const existingByStudentId = new Map(existingEnrollments.map((enrollment) => [enrollment.studentId, enrollment]));
      const enrolled = [];
      for (const studentId of input.studentIds) {
        const existing = existingByStudentId.get(studentId);
        const result = existing
          ? await transaction.enrollment.update({
              where: { id: existing.id },
              data: { sectionId: section.id, status: EnrollmentStatus.ENROLLED, enrolledAt: new Date() },
              include: {
                student: { select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true } },
                section: { select: { id: true, name: true, gradeLevel: true } },
                schoolYear: { select: { id: true, name: true } },
              },
            })
          : await transaction.enrollment.create({
              data: { studentId, sectionId: section.id, schoolYearId: section.schoolYearId },
              include: {
                student: { select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true } },
                section: { select: { id: true, name: true, gradeLevel: true } },
                schoolYear: { select: { id: true, name: true } },
              },
            });
        if (request) {
          await audit(transaction, request, {
            action: "ENROLL",
            entityType: "Enrollment",
            entityId: result.id,
            studentId,
            after: { studentId, sectionId: section.id, schoolYearId: section.schoolYearId, status: result.status },
          });
        }
        enrolled.push(result);
      }
      return { enrolled, skipped: [] };
    }, { timeout: 30000 });
    invalidateAdminDashboardCache();
    return result;
  } catch (error) {
    throwEnrollmentError(error);
  }
}

export async function transferEnrollment(id: string, input: TransferEnrollmentInput, request?: Request) {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const enrollment = await transaction.enrollment.findUnique({
        where: { id },
        include: { section: { select: { id: true, name: true, schoolYearId: true } } },
      });
      if (!enrollment) throw new AppError("Enrollment not found", 404);
      if (enrollment.status !== EnrollmentStatus.ENROLLED) {
        throw new AppError("Only currently enrolled students can be transferred", 400, "ENROLLMENT_NOT_ACTIVE");
      }
      if (!enrollment.section || !enrollment.sectionId) {
        throw new AppError("An unassigned enrollment cannot be transferred", 409, "ENROLLMENT_UNASSIGNED");
      }
      const nextSection = await transaction.section.findUnique({
        where: { id: input.sectionId },
        select: { id: true, name: true, schoolYearId: true },
      });
      if (!nextSection) throw new AppError("Section not found", 404);
      if (nextSection.schoolYearId !== enrollment.schoolYearId) {
        throw new AppError("A student can only be transferred within the same school year", 400, "DIFFERENT_SCHOOL_YEAR");
      }
      if (nextSection.id === enrollment.sectionId) {
        throw new AppError("The student is already in this section", 400, "SAME_SECTION");
      }
      await assertSectionHasCapacity(transaction, nextSection.id);
      // Attendance and grades remain with their original class offerings to preserve the historical class record.
      const updated = await transaction.enrollment.update({
        where: { id },
        data: { sectionId: nextSection.id },
      });
      if (request) {
        await audit(transaction, request, {
          action: "TRANSFER",
          entityType: "Enrollment",
          entityId: id,
          studentId: enrollment.studentId,
          before: {
            sectionId: enrollment.sectionId,
            sectionName: enrollment.section.name,
            status: enrollment.status,
          },
          after: {
            sectionId: nextSection.id,
            sectionName: nextSection.name,
            status: updated.status,
            effectiveDate: input.effectiveDate ?? null,
            reason: input.reason ?? null,
          },
        });
      }
      return { updated, oldSection: enrollment.section, nextSection };
    });
    invalidateAdminDashboardCache();
    return result.updated;
  } catch (error) {
    throwEnrollmentError(error);
  }
}

export async function updateEnrollmentStatus(
  id: string,
  input: UpdateEnrollmentStatusInput,
  request?: Request,
) {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.enrollment.findUnique({
        where: { id },
        select: { status: true, studentId: true, sectionId: true },
      });
      if (!existing) throw new AppError("Enrollment not found", 404);
      if (input.status === EnrollmentStatus.ENROLLED && existing.status !== EnrollmentStatus.ENROLLED && existing.sectionId) {
        await assertSectionHasCapacity(transaction, existing.sectionId);
      }
      const updated = await transaction.enrollment.update({
        where: { id },
        data: { status: input.status },
      });
      if (request) {
        await audit(transaction, request, {
          action: "STATUS_CHANGE",
          entityType: "Enrollment",
          entityId: id,
          studentId: existing.studentId,
          before: { status: existing.status },
          after: { status: input.status, reason: input.reason ?? null },
        });
      }
      return { updated, previousStatus: existing.status };
    });
    invalidateAdminDashboardCache();
    return result.updated;
  } catch (error) {
    throwEnrollmentError(error);
  }
}

export async function listEnrollments(rawQuery: unknown, request?: Request) {
  const query = parseQuery(listEnrollmentsQuerySchema, rawQuery);
  const { skip, take } = parsePagination(query);
  const schoolYearId = await resolveSchoolYearId(query.schoolYearId);
  const where: Prisma.EnrollmentWhereInput = {
    schoolYearId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    ...(query.gradeLevel !== undefined ? { section: { is: { gradeLevel: query.gradeLevel } } } : {}),
    ...(query.search
      ? {
          student: {
            OR: [
              { studentNo: { contains: query.search, mode: "insensitive" } },
              { firstName: { contains: query.search, mode: "insensitive" } },
              { middleName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
  const orderBy: Prisma.EnrollmentOrderByWithRelationInput[] = [
    query.sortBy === "studentNo"
      ? { student: { studentNo: query.order } }
      : query.sortBy === "lastName"
        ? { student: { lastName: query.order } }
        : { [query.sortBy]: query.order },
    { id: "asc" },
  ];
  const [data, total] = await prisma.$transaction([
    prisma.enrollment.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        student: {
          select: {
            id: true,
            studentNo: true,
            firstName: true,
            middleName: true,
            lastName: true,
            status: true,
          },
        },
        section: { select: { id: true, name: true, gradeLevel: true } },
        schoolYear: { select: { id: true, name: true, isCurrent: true } },
      },
      }),
    prisma.enrollment.count({ where }),
  ]);
  if (request) {
    await prisma.$transaction((transaction) => auditStudentViews(
      transaction,
      request,
      data.map((enrollment) => ({
        action: "VIEW_ENROLLMENTS",
        entityType: "Enrollment",
        entityId: enrollment.id,
        studentId: enrollment.student.id,
      })),
    ));
  }
  return {
    data,
    meta: buildPaginationMeta(query.page, query.pageSize, total),
  };
}

export async function listUnassignedStudents(rawQuery: unknown) {
  const query = parseQuery(unassignedStudentsQuerySchema, rawQuery);
  const { skip, take } = parsePagination(query);
  const schoolYearId = await resolveSchoolYearId(query.schoolYearId);
  const where: Prisma.StudentWhereInput = {
    status: StudentStatus.ACTIVE,
    enrollments: {
      none: { schoolYearId, status: EnrollmentStatus.ENROLLED },
    },
    ...(query.search
      ? {
          OR: [
            { studentNo: { contains: query.search, mode: "insensitive" } },
            { firstName: { contains: query.search, mode: "insensitive" } },
            { middleName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      skip,
      take,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      select: {
        id: true,
        studentNo: true,
        firstName: true,
        middleName: true,
        lastName: true,
        sex: true,
        status: true,
      },
    }),
    prisma.student.count({ where }),
  ]);
  return { data, meta: buildPaginationMeta(query.page, query.pageSize, total) };
}
