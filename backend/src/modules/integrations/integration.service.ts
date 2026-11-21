import {
  AlumniRecordKind,
  EnrollmentStatus,
  FeedImportMode,
  LmsEventType,
  Prisma,
  Role,
  SeniorHighStrand,
  StudentStatus,
} from "@prisma/client";
import type { Request } from "express";
import { z } from "zod";
import { audit } from "../../audit.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { writeCsv } from "../../utils/csv.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { formatDateString, parseDateString, todayInManila } from "../../utils/dates.js";
import { invalidateAdminDashboardCache } from "../dashboard/dashboard.helpers.js";
import {
  alumniRecordSchema,
  libraryLoanSchema,
  lmsEventSchema,
  syncHistoryQuerySchema,
  syncParamsSchema,
  syncQuerySchema,
  type IntegrationSource,
} from "./integration.schema.js";
import { getAlumniBatch } from "../../sources/alumni.js";
import { getLibraryBatch } from "../../sources/library.js";
import { getLmsBatch } from "../../sources/lms.js";
import type { FeedBatch, FeedRow } from "../../sources/types.js";

type IntegrationUser = { id: string; role: Role };
type Transaction = Prisma.TransactionClient;

const sourceFetchers = {
  lms: getLmsBatch,
  library: getLibraryBatch,
  alumni: getAlumniBatch,
} satisfies Record<IntegrationSource, (next?: boolean) => FeedBatch>;

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      errors: parsed.error.flatten().fieldErrors,
    });
  }
  return parsed.data;
}

function rawJson(row: FeedRow): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue;
}

async function findStudent(transaction: Transaction, row: { studentNo?: string; email?: string }) {
  const predicates: Prisma.StudentWhereInput[] = [];
  if (row.studentNo) predicates.push({ studentNo: row.studentNo });
  if (row.email) predicates.push({ user: { is: { email: { equals: row.email, mode: "insensitive" } } } });
  const matches = await transaction.student.findMany({
    where: { OR: predicates },
    select: { id: true, studentNo: true, status: true, user: { select: { email: true } } },
    take: 2,
  });
  if (!matches.length) return { student: null, reason: "Student number or email did not match a student" };
  if (matches.length > 1) return { student: null, reason: "Student number and email matched different students" };
  return { student: matches[0], reason: null };
}

function sourceSchema(source: IntegrationSource) {
  if (source === "lms") return lmsEventSchema;
  if (source === "library") return libraryLoanSchema;
  return alumniRecordSchema;
}

function enumKind<T extends string>(value: string, values: Record<string, T>): T {
  const result = values[value];
  if (!result) throw new AppError("Unexpected validated feed value", 500);
  return result;
}

async function upsertFeedRow(
  transaction: Transaction,
  source: IntegrationSource,
  externalId: string,
  studentId: string,
  row: Record<string, unknown>,
) {
  if (source === "lms") {
    let courseId: string | null = null;
    if (typeof row.courseCode === "string") {
      const course = await transaction.subject.findUnique({
        where: { code: row.courseCode },
        select: { id: true },
      });
      if (!course) throw new AppError(`Course code ${row.courseCode} was not found`, 404);
      courseId = course.id;
    }
    const data = {
      studentId,
      courseId,
      type: enumKind(row.type as string, { Login: LmsEventType.LOGIN, Submission: LmsEventType.SUBMISSION, Quiz: LmsEventType.QUIZ }),
      occurredAt: new Date(row.occurredAt as string),
      score: row.score === undefined || row.score === null ? null : new Prisma.Decimal(row.score as number),
      onTime: row.onTime === undefined ? null : row.onTime as boolean | null,
    };
    return transaction.lmsEvent.upsert({
      where: { source_externalId: { source, externalId } },
      create: { source, externalId, ...data },
      update: data,
    });
  }
  if (source === "library") {
    const data = {
      studentId,
      bookTitle: row.bookTitle as string,
      loanedOn: new Date(`${row.loanedOn as string}T00:00:00.000Z`),
      dueOn: new Date(`${row.dueOn as string}T00:00:00.000Z`),
      returnedOn: row.returnedOn ? new Date(`${row.returnedOn as string}T00:00:00.000Z`) : null,
    };
    return transaction.libraryLoan.upsert({
      where: { source_externalId: { source, externalId } },
      create: { source, externalId, ...data },
      update: data,
    });
  }
  const data = {
    studentId,
    kind: enumKind(row.kind as string, {
      Donation: AlumniRecordKind.DONATION,
      Event: AlumniRecordKind.EVENT,
      Mentoring: AlumniRecordKind.MENTORING,
    }),
    amount: row.amount === undefined || row.amount === null ? null : new Prisma.Decimal(row.amount as number),
    occurredOn: new Date(`${row.occurredOn as string}T00:00:00.000Z`),
    detail: row.detail as string | null | undefined ?? null,
  };
  return transaction.alumniRecord.upsert({
    where: { source_externalId: { source, externalId } },
    create: { source, externalId, ...data },
    update: data,
  });
}

export async function syncFeed(
  rawParams: unknown,
  rawQuery: unknown,
  user: IntegrationUser,
  request?: Pick<Request, "user" | "ip">,
) {
  const { source } = parse(syncParamsSchema, rawParams);
  const query = parse(syncQuerySchema, rawQuery);
  const batch = sourceFetchers[source](query.batch === "next");
  const mode = query.mode === "preview" ? FeedImportMode.PREVIEW : FeedImportMode.COMMIT;
  const schema = sourceSchema(source);

  const result = await prisma.$transaction(async (transaction) => {
    const run = await transaction.feedImportRun.create({
      data: { source, mode, runById: user.id, received: batch.rows.length },
    });
    const seenIds = new Set<string>();
    let accepted = 0;
    const rejects: Array<{ rowNumber: number; raw: Prisma.InputJsonValue; reason: string }> = [];

    for (const [index, raw] of batch.rows.entries()) {
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        rejects.push({
          rowNumber: index + 1,
          raw: rawJson(raw),
          reason: parsed.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`).join("; "),
        });
        continue;
      }
      const row = parsed.data as Record<string, unknown>;
      const externalId = row.externalId as string;
      if (seenIds.has(externalId)) {
        rejects.push({ rowNumber: index + 1, raw: rawJson(raw), reason: `Duplicate external ID ${externalId} in this batch` });
        continue;
      }
      seenIds.add(externalId);

      const { student, reason } = await findStudent(transaction, {
        studentNo: row.studentNo as string | undefined,
        email: row.email as string | undefined,
      });
      if (!student) {
        rejects.push({ rowNumber: index + 1, raw: rawJson(raw), reason: reason ?? "Student not found" });
        continue;
      }
      if (source === "alumni" && student.status !== StudentStatus.GRADUATED) {
        rejects.push({ rowNumber: index + 1, raw: rawJson(raw), reason: "Alumni records are only accepted for graduated students" });
        continue;
      }
      if (query.mode === "commit") {
        try {
          await upsertFeedRow(transaction, source, externalId, student.id, row);
        } catch (error) {
          if (error instanceof AppError) {
            rejects.push({ rowNumber: index + 1, raw: rawJson(raw), reason: error.message });
            continue;
          }
          throw error;
        }
      }
      accepted += 1;
    }

    if (rejects.length) {
      await transaction.feedImportReject.createMany({
        data: rejects.map((reject) => ({ runId: run.id, ...reject })),
      });
    }
    const completed = await transaction.feedImportRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), accepted, rejected: rejects.length },
    });
    const savedRejects = await transaction.feedImportReject.findMany({
      where: { runId: run.id },
      orderBy: { rowNumber: "asc" },
    });
    if (mode === FeedImportMode.COMMIT && request) {
      await audit(transaction, request, {
        action: "SYNC_COMMIT",
        entityType: "SyncRun",
        entityId: run.id,
        after: {
          source,
          received: completed.received,
          accepted: completed.accepted,
          rejected: completed.rejected,
          runId: run.id,
        },
      });
    }
    return { run: completed, rejects: savedRejects };
  });
  if (mode === FeedImportMode.COMMIT && source === "library") {
    invalidateAdminDashboardCache();
  }
  return { data: result.run, rejects: result.rejects };
}

export async function listSyncRuns(rawQuery: unknown) {
  const query = parse(syncHistoryQuerySchema, rawQuery);
  const skip = (query.page - 1) * query.pageSize;
  const [data, total] = await prisma.$transaction([
    prisma.feedImportRun.findMany({
      skip,
      take: query.pageSize,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      include: { runBy: { select: { id: true, email: true } } },
    }),
    prisma.feedImportRun.count(),
  ]);
  return { data, meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
}

export async function getSyncRejects(id: string) {
  const run = await prisma.feedImportRun.findUnique({ where: { id }, select: { id: true } });
  if (!run) throw new AppError("Sync run not found", 404, "SYNC_RUN_NOT_FOUND");
  return prisma.feedImportReject.findMany({
    where: { runId: id },
    orderBy: { rowNumber: "asc" },
  });
}

async function findScopedStudent(id: string, user: IntegrationUser) {
  let scope: Prisma.StudentWhereInput = {};
  if (user.role === Role.STUDENT || user.role === Role.ALUMNI) {
    scope = { userId: user.id };
  } else if (user.role === Role.TEACHER) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
    scope = teacher
      ? {
          status: StudentStatus.ACTIVE,
          enrollments: {
            some: {
              status: EnrollmentStatus.ENROLLED,
              schoolYear: { is: { isCurrent: true } },
              section: { is: { adviserId: teacher.id } },
            },
          },
        }
      : { id: "__no_access__" };
  } else if (user.role !== Role.ADMIN) {
    scope = { id: "__no_access__" };
  }
  const student = await prisma.student.findFirst({
    where: { id, ...scope },
    select: { id: true, status: true },
  });
  if (!student) throw new AppError("Student not found", 404, "STUDENT_NOT_FOUND");
  return student;
}

export async function getStudentLms(id: string, user: IntegrationUser) {
  const student = await findScopedStudent(id, user);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [events, recent] = await Promise.all([
    prisma.lmsEvent.findMany({
      where: { studentId: student.id, occurredAt: { gte: since } },
      select: { type: true, score: true, onTime: true },
    }),
    prisma.lmsEvent.findMany({
      where: { studentId: student.id },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 20,
      include: { course: { select: { code: true, name: true } } },
    }),
  ]);
  const submissions = events.filter((event) => event.type === LmsEventType.SUBMISSION && event.onTime !== null);
  const quizzes = events.filter((event) => event.type === LmsEventType.QUIZ && event.score !== null);
  return {
    summary: {
      logins: events.filter((event) => event.type === LmsEventType.LOGIN).length,
      onTimeSubmissionPercent: submissions.length
        ? Math.round((submissions.filter((event) => event.onTime).length / submissions.length) * 100)
        : null,
      quizAverage: quizzes.length
        ? quizzes.reduce((sum, event) => sum + Number(event.score), 0) / quizzes.length
        : null,
      since,
    },
    events: recent,
  };
}

export async function getStudentLibrary(id: string, user: IntegrationUser) {
  const student = await findScopedStudent(id, user);
  const today = parseDateString(todayInManila());
  const loans = await prisma.libraryLoan.findMany({
    where: { studentId: student.id },
    orderBy: [{ loanedOn: "desc" }, { id: "desc" }],
    select: { id: true, bookTitle: true, loanedOn: true, dueOn: true, returnedOn: true },
  });
  return loans.map((loan) => ({
    ...loan,
    status: loan.returnedOn ? "Returned" : loan.dueOn < today ? "Overdue" : "Borrowed",
  }));
}

const daysOverdueRanges = ["ANY", "1_7", "8_30", "31_PLUS"] as const;
const libraryLoanListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  status: z.enum(["ALL", "BORROWED", "OVERDUE", "RETURNED"]).default("ALL"),
  search: z.string().trim().max(100).optional(),
  strand: z.nativeEnum(SeniorHighStrand).optional(),
  gradeLevel: z.coerce.number().int().min(11).max(12).optional(),
  sectionId: z.string().trim().min(1).max(100).optional(),
  daysOverdue: z.enum(daysOverdueRanges).default("ANY"),
  sortBy: z.enum(["DAYS_OVERDUE_ASC", "DAYS_OVERDUE_DESC"]).default("DAYS_OVERDUE_DESC"),
});

const millisecondsPerDay = 24 * 60 * 60 * 1000;

function dateOffset(date: Date, days: number): Date {
  return new Date(date.getTime() + days * millisecondsPerDay);
}

function daysOverdueWhere(range: z.infer<typeof libraryLoanListQuerySchema>["daysOverdue"], today: Date): Prisma.LibraryLoanWhereInput {
  if (range === "1_7") {
    return { returnedOn: null, dueOn: { gte: dateOffset(today, -7), lt: today } };
  }
  if (range === "8_30") {
    return { returnedOn: null, dueOn: { gte: dateOffset(today, -30), lt: dateOffset(today, -7) } };
  }
  if (range === "31_PLUS") {
    return { returnedOn: null, dueOn: { lt: dateOffset(today, -30) } };
  }
  return {};
}

function overdueDayCount(dueOn: Date, returnedOn: Date | null, today: Date): number {
  if (returnedOn || dueOn >= today) return 0;
  return Math.floor((today.getTime() - dueOn.getTime()) / millisecondsPerDay);
}

async function libraryLoanQuery(rawQuery: unknown, user: IntegrationUser) {
  const query = parse(libraryLoanListQuerySchema, rawQuery);
  const today = parseDateString(todayInManila());
  let teacherId: string | undefined;
  if (user.role === Role.TEACHER) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!teacher) throw new AppError("Teacher profile not found", 404, "TEACHER_PROFILE_NOT_FOUND");
    teacherId = teacher.id;
  } else if (user.role !== Role.ADMIN) {
    throw new AppError("Not authorized to view the library loan list", 403, "FORBIDDEN");
  }

  const sectionFilter: Prisma.SectionWhereInput = {
    ...(teacherId ? { adviserId: teacherId } : {}),
    ...(query.sectionId ? { id: query.sectionId } : {}),
    ...(query.gradeLevel ? { gradeLevel: query.gradeLevel } : {}),
    ...(query.strand ? { strand: query.strand } : {}),
  };
  const currentEnrollmentWhere: Prisma.EnrollmentWhereInput = {
    status: EnrollmentStatus.ENROLLED,
    schoolYear: { is: { isCurrent: true } },
    section: { is: sectionFilter },
  };
  const hasSectionScope = Boolean(teacherId || query.sectionId || query.gradeLevel || query.strand);
  const studentScope: Prisma.LibraryLoanWhereInput = hasSectionScope
    ? {
        student: {
          is: {
            ...(teacherId ? { status: StudentStatus.ACTIVE } : {}),
            enrollments: { some: currentEnrollmentWhere },
          },
        },
      }
    : {};

  const search = query.search?.trim();
  const searchTerms = search?.split(/\s+/).filter(Boolean) ?? [];
  const searchWhere: Prisma.LibraryLoanWhereInput = searchTerms.length ? {
    OR: [
      { bookTitle: { contains: search, mode: "insensitive" } },
      { student: { is: { id: search } } },
      { student: { is: { studentNo: { contains: search, mode: "insensitive" } } } },
      {
        student: {
          is: {
            AND: searchTerms.map((term) => ({
              OR: [
                { firstName: { contains: term, mode: "insensitive" } },
                { middleName: { contains: term, mode: "insensitive" } },
                { lastName: { contains: term, mode: "insensitive" } },
              ],
            })),
          },
        },
      },
    ],
  } : {};
  const statusWhere: Prisma.LibraryLoanWhereInput = query.status === "OVERDUE"
    ? { returnedOn: null, dueOn: { lt: today } }
    : query.status === "BORROWED"
      ? { returnedOn: null, dueOn: { gte: today } }
      : query.status === "RETURNED" ? { returnedOn: { not: null } } : {};
  const rangeWhere = daysOverdueWhere(query.daysOverdue, today);
  const baseWhere = { AND: [studentScope, searchWhere] } satisfies Prisma.LibraryLoanWhereInput;
  const where: Prisma.LibraryLoanWhereInput = { AND: [baseWhere, statusWhere, rangeWhere] };
  const overdueWhere: Prisma.LibraryLoanWhereInput = {
    AND: [baseWhere, { returnedOn: null, dueOn: { lt: today } }, rangeWhere],
  };
  const sectionFacetsWhere: Prisma.SectionWhereInput = {
    schoolYear: { is: { isCurrent: true } },
    ...(teacherId ? { adviserId: teacherId } : {}),
  };
  return {
    query,
    today,
    where,
    overdueWhere,
    baseWhere,
    currentEnrollmentWhere,
    sectionFacetsWhere,
    sortOrder: query.sortBy === "DAYS_OVERDUE_ASC" ? "desc" as const : "asc" as const,
  };
}

export async function listLibraryLoans(rawQuery: unknown, user: IntegrationUser) {
  const context = await libraryLoanQuery(rawQuery, user);
  const { query, today, where, overdueWhere, baseWhere, currentEnrollmentWhere, sectionFacetsWhere, sortOrder } = context;
  const [loans, total, borrowed, overdue, returned, overdueStudents, sections] = await Promise.all([
    prisma.libraryLoan.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: [{ returnedOn: "asc" }, { dueOn: sortOrder }, { id: "asc" }],
      select: {
        id: true,
        bookTitle: true,
        loanedOn: true,
        dueOn: true,
        returnedOn: true,
        student: {
          select: {
            id: true,
            studentNo: true,
            firstName: true,
            middleName: true,
            lastName: true,
            enrollments: {
              where: currentEnrollmentWhere,
              take: 1,
              select: {
                section: {
                  select: {
                    id: true,
                    name: true,
                    gradeLevel: true,
                    strand: true,
                    adviser: { select: { firstName: true, middleName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.libraryLoan.count({ where }),
    prisma.libraryLoan.count({ where: { AND: [baseWhere, { returnedOn: null, dueOn: { gte: today } }] } }),
    prisma.libraryLoan.count({ where: overdueWhere }),
    prisma.libraryLoan.count({ where: { AND: [baseWhere, { returnedOn: { not: null } }] } }),
    prisma.libraryLoan.groupBy({ by: ["studentId"], where: overdueWhere }),
    prisma.section.findMany({
      where: sectionFacetsWhere,
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      select: { id: true, name: true, gradeLevel: true, strand: true },
    }),
  ]);
  return {
    data: loans.map((loan) => {
      const section = loan.student.enrollments[0]?.section ?? null;
      return {
        id: loan.id,
        bookTitle: loan.bookTitle,
        loanedOn: loan.loanedOn,
        dueOn: loan.dueOn,
        returnedOn: loan.returnedOn,
        status: loan.returnedOn ? "Returned" : loan.dueOn < today ? "Overdue" : "Borrowed",
        daysOverdue: overdueDayCount(loan.dueOn, loan.returnedOn, today),
        student: {
          id: loan.student.id,
          studentNo: loan.student.studentNo,
          firstName: loan.student.firstName,
          middleName: loan.student.middleName,
          lastName: loan.student.lastName,
          section: section ? {
            id: section.id,
            name: section.name,
            gradeLevel: section.gradeLevel,
            strand: section.strand,
          } : null,
          adviser: section?.adviser ?? null,
        },
      };
    }),
    meta: buildPaginationMeta(query.page, query.pageSize, total),
    summary: {
      borrowed,
      overdue,
      overdueStudents: overdueStudents.length,
      overdueItems: overdue,
      returned,
    },
    filters: {
      strands: Object.values(SeniorHighStrand),
      gradeLevels: [11, 12],
      sections,
    },
  };
}

export async function exportLibraryLoans(
  rawQuery: unknown,
  user: IntegrationUser,
  request: Pick<Request, "user" | "ip">,
): Promise<string> {
  const { query, today, where, currentEnrollmentWhere, sortOrder } = await libraryLoanQuery(rawQuery, user);
  const total = await prisma.libraryLoan.count({ where });
  if (total > 10_000) {
    throw new AppError("CSV export is limited to 10,000 items; narrow the filters.", 413, "EXPORT_TOO_LARGE");
  }
  const loans = await prisma.libraryLoan.findMany({
    where,
    take: total,
    orderBy: [{ returnedOn: "asc" }, { dueOn: sortOrder }, { id: "asc" }],
    select: {
      bookTitle: true,
      loanedOn: true,
      dueOn: true,
      returnedOn: true,
      student: {
        select: {
          id: true,
          studentNo: true,
          firstName: true,
          middleName: true,
          lastName: true,
          enrollments: {
            where: currentEnrollmentWhere,
            take: 1,
            select: {
              section: {
                select: {
                  name: true,
                  gradeLevel: true,
                  strand: true,
                  adviser: { select: { firstName: true, middleName: true, lastName: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (user.role === Role.ADMIN) {
    await audit(prisma, request, {
      action: "EXPORT_LIBRARY_OVERDUE",
      entityType: "LibraryLoan",
      after: {
        status: query.status,
        strand: query.strand,
        gradeLevel: query.gradeLevel,
        sectionId: query.sectionId,
        daysOverdue: query.daysOverdue,
        sortBy: query.sortBy,
        rows: loans.length,
      },
    });
  }
  const rows = loans.map((loan) => {
    const section = loan.student.enrollments[0]?.section ?? null;
    const studentName = [loan.student.firstName, loan.student.middleName, loan.student.lastName].filter(Boolean).join(" ");
    const adviserName = section?.adviser
      ? [section.adviser.firstName, section.adviser.middleName, section.adviser.lastName].filter(Boolean).join(" ")
      : "";
    return {
      "Student Name": studentName,
      "Student ID": loan.student.studentNo,
      "Grade Level": section?.gradeLevel ?? "",
      Strand: section?.strand ?? "",
      Section: section?.name ?? "",
      Adviser: adviserName,
      "Book Title": loan.bookTitle,
      "Borrow Date": formatDateString(loan.loanedOn),
      "Due Date": formatDateString(loan.dueOn),
      "Days Overdue": overdueDayCount(loan.dueOn, loan.returnedOn, today),
    };
  });
  return writeCsv(rows, [
    "Student Name",
    "Student ID",
    "Grade Level",
    "Strand",
    "Section",
    "Adviser",
    "Book Title",
    "Borrow Date",
    "Due Date",
    "Days Overdue",
  ]);
}

export async function getStudentAlumni(id: string, user: IntegrationUser) {
  const student = await findScopedStudent(id, user);
  if (student.status !== StudentStatus.GRADUATED) {
    throw new AppError("Alumni records are only available for graduated students", 404, "ALUMNI_RECORDS_NOT_FOUND");
  }
  const records = await prisma.alumniRecord.findMany({
    where: { studentId: student.id },
    orderBy: [{ occurredOn: "desc" }, { id: "desc" }],
  });
  return records;
}

async function getOwnStudentId(user: IntegrationUser): Promise<string> {
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) throw new AppError("Student profile not found", 404, "STUDENT_PROFILE_NOT_FOUND");
  return student.id;
}

export async function getMyStudentLms(user: IntegrationUser) {
  return getStudentLms(await getOwnStudentId(user), user);
}

export async function getMyStudentLibrary(user: IntegrationUser) {
  return getStudentLibrary(await getOwnStudentId(user), user);
}

export async function getMyStudentAlumni(user: IntegrationUser) {
  return getStudentAlumni(await getOwnStudentId(user), user);
}
