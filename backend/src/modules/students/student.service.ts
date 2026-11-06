import { EnrollmentStatus, Prisma, StudentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { audit } from "../../audit.js";
import { createPersonAccount, setLinkedUserActive } from "../../services/account.service.js";
import { logAudit } from "../../services/audit.service.js";
import { AppError } from "../../utils/AppError.js";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination.js";
import {
  listStudentsQuerySchema,
  type CreateAccountInput,
  type CreateStudentInput,
  type ListStudentsQuery,
  type UpdateStatusInput,
  type UpdateStudentInput,
} from "./student.schema.js";
import type { Request } from "express";

const currentEnrollmentInclude = {
  enrollments: {
    where: {
      status: EnrollmentStatus.ENROLLED,
      schoolYear: { isCurrent: true },
    },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      section: { select: { id: true, name: true, gradeLevel: true } },
      schoolYear: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.StudentInclude;

const studentHistoryInclude = {
  user: { select: { email: true } },
  enrollments: {
    orderBy: [{ schoolYear: { startDate: "desc" } }, { createdAt: "desc" }],
    include: {
      section: { select: { id: true, name: true, gradeLevel: true } },
      schoolYear: { select: { id: true, name: true, isCurrent: true } },
    },
  },
} satisfies Prisma.StudentInclude;

function isPrismaKnownError(
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function isStudentNumberConflict(error: Prisma.PrismaClientKnownRequestError): boolean {
  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.includes("studentNo")
    : typeof target === "string" && target.includes("studentNo");
}

function rethrowStudentError(error: unknown): never {
  if (isPrismaKnownError(error, "P2025")) {
    throw new AppError("Student not found", 404);
  }
  if (isPrismaKnownError(error, "P2002")) {
    if (isStudentNumberConflict(error)) {
      throw new AppError("A student with this student number already exists", 409, "STUDENT_NO_EXISTS");
    }
    throw new AppError("A student with these details already exists", 409);
  }
  throw error;
}

function studentAuditDetails(
  fields: CreateStudentInput | UpdateStudentInput,
): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  ) as Prisma.InputJsonObject;
}

function getRequestIp(request?: Request): string | undefined {
  return request?.ip;
}

export async function listStudents(rawQuery: unknown): Promise<{
  data: Array<Record<string, unknown>>;
  meta: ReturnType<typeof buildPaginationMeta>;
}> {
  const parsedQuery = listStudentsQuerySchema.safeParse(rawQuery);
  if (!parsedQuery.success) {
    throw new AppError("Validation failed", 400, undefined, {
      errors: parsedQuery.error.flatten().fieldErrors,
    });
  }
  const query: ListStudentsQuery = parsedQuery.data;
  const { skip, take } = parsePagination(query);

  let schoolYearId = query.schoolYearId;
  if ((query.gradeLevel !== undefined || query.sectionId !== undefined) && !schoolYearId) {
    const currentSchoolYear = await prisma.schoolYear.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    });
    if (!currentSchoolYear) {
      throw new AppError("No current school year is configured", 400);
    }
    schoolYearId = currentSchoolYear.id;
  }

  const enrollmentFilter: Prisma.EnrollmentWhereInput | undefined =
    schoolYearId || query.sectionId || query.gradeLevel !== undefined
      ? {
          status: EnrollmentStatus.ENROLLED,
          ...(schoolYearId ? { schoolYearId } : {}),
          ...(query.sectionId ? { sectionId: query.sectionId } : {}),
          ...(query.gradeLevel !== undefined
            ? { section: { is: { gradeLevel: query.gradeLevel } } }
            : {}),
        }
      : undefined;

  const where: Prisma.StudentWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
            { studentNo: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(enrollmentFilter ? { enrollments: { some: enrollmentFilter } } : {}),
  };

  const orderBy: Prisma.StudentOrderByWithRelationInput[] = [
    { [query.sortBy]: query.order },
    { id: "asc" },
  ];
  const [students, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      skip,
      take,
      orderBy,
      include: currentEnrollmentInclude,
    }),
    prisma.student.count({ where }),
  ]);

  return {
    data: students.map(({ enrollments, ...student }) => ({
      ...student,
      currentEnrollment: enrollments[0] ?? null,
    })),
    meta: buildPaginationMeta(query.page, query.pageSize, total),
  };
}

export async function getStudentById(id: string, request?: Request) {
  return prisma.$transaction(async (transaction) => {
    const student = await transaction.student.findUnique({
      where: { id },
      include: studentHistoryInclude,
    });
    if (!student) {
      throw new AppError("Student not found", 404);
    }
    if (request) {
      await audit(transaction, request, {
        action: "VIEW_STUDENT",
        entityType: "Student",
        entityId: id,
        studentId: id,
      });
    }
    const currentEnrollment =
      student.enrollments.find(
        (enrollment) =>
          enrollment.status === EnrollmentStatus.ENROLLED && enrollment.schoolYear.isCurrent,
      ) ?? null;
    return { ...student, currentEnrollment };
  });
}

export async function createStudent(
  input: CreateStudentInput,
  request?: Request,
  confirmDuplicateHeader?: string | string[],
) {
  const { confirmDuplicate, ...studentData } = input;

  try {
    const existingStudentNumber = await prisma.student.findUnique({
      where: { studentNo: studentData.studentNo },
      select: { id: true },
    });
    if (existingStudentNumber) {
      throw new AppError(
        "A student with this student number already exists",
        409,
        "STUDENT_NO_EXISTS",
      );
    }
    const birthDateStart = new Date(
      Date.UTC(
        studentData.birthDate.getUTCFullYear(),
        studentData.birthDate.getUTCMonth(),
        studentData.birthDate.getUTCDate(),
      ),
    );
    const birthDateEnd = new Date(birthDateStart.getTime() + 24 * 60 * 60 * 1000);
    const matches = await prisma.student.findMany({
      where: {
        firstName: { equals: studentData.firstName, mode: "insensitive" },
        lastName: { equals: studentData.lastName, mode: "insensitive" },
        birthDate: { gte: birthDateStart, lt: birthDateEnd },
      },
      select: {
        id: true,
        studentNo: true,
        firstName: true,
        middleName: true,
        lastName: true,
        birthDate: true,
        status: true,
      },
    });
    const headerConfirmed =
      confirmDuplicateHeader === "true" ||
      (Array.isArray(confirmDuplicateHeader) && confirmDuplicateHeader.includes("true"));
    if (matches.length && !confirmDuplicate && !headerConfirmed) {
      throw new AppError("A possible matching student was found", 409, "POSSIBLE_DUPLICATE", {
        matches,
      });
    }

    const student = await prisma.$transaction(async (transaction) => {
      const created = await transaction.student.create({ data: studentData });
      if (request) {
        await audit(transaction, request, {
          action: "CREATE",
          entityType: "Student",
          entityId: created.id,
          studentId: created.id,
          after: studentAuditDetails(studentData),
        });
      }
      return created;
    });
    return student;
  } catch (error) {
    rethrowStudentError(error);
  }
}

export async function updateStudent(id: string, input: UpdateStudentInput, request?: Request) {
  try {
    const after = await prisma.$transaction(async (transaction) => {
      const before = await transaction.student.findUnique({ where: { id } });
      if (!before) throw new AppError("Student not found", 404);
      const updated = await transaction.student.update({ where: { id }, data: input });
      if (request) {
        const oldValues = Object.fromEntries(Object.keys(input).map((key) => [
          key,
          before[key as keyof typeof before] instanceof Date
            ? (before[key as keyof typeof before] as Date).toISOString()
            : before[key as keyof typeof before],
        ]));
        await audit(transaction, request, {
          action: "UPDATE",
          entityType: "Student",
          entityId: id,
          studentId: id,
          before: oldValues,
          after: studentAuditDetails(input),
        });
      }
      return updated;
    });
    return after;
  } catch (error) {
    rethrowStudentError(error);
  }
}

export async function updateStudentStatus(id: string, input: UpdateStatusInput, request?: Request) {
  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const student = await transaction.student.findUnique({
        where: { id },
        select: { id: true, userId: true, status: true },
      });
      if (!student) {
        throw new AppError("Student not found", 404);
      }

      const result = await transaction.student.update({
        where: { id },
        data: { status: input.status },
      });
      if (request) {
        await audit(transaction, request, {
          action: "STATUS_CHANGE",
          entityType: "Student",
          entityId: id,
          studentId: id,
          before: { status: student.status },
          after: { status: input.status, reason: input.reason ?? null },
        });
      }
      if (student.userId && input.status === StudentStatus.ACTIVE) {
        await setLinkedUserActive(transaction, student.userId, true);
      } else if (
        student.userId &&
        (input.status === StudentStatus.INACTIVE ||
          input.status === StudentStatus.DROPPED ||
          input.status === StudentStatus.TRANSFERRED)
      ) {
        await setLinkedUserActive(transaction, student.userId, false);
      }
      return { student: result, previousStatus: student.status };
    });

    return updated.student;
  } catch (error) {
    rethrowStudentError(error);
  }
}

export async function createStudentAccount(id: string, input: CreateAccountInput, request?: Request) {
  const created = await createPersonAccount({
    kind: "student",
    personId: id,
    email: input.email,
    temporaryPassword: input.temporaryPassword,
  });
  await logAudit({
    userId: request?.user?.id,
    action: "ACCOUNT_CREATED",
    entity: "Student",
    entityId: id,
    details: { email: input.email },
    ipAddress: getRequestIp(request),
  });
  return { studentId: id, ...created };
}
