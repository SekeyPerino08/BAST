import {
  AlumniRecordKind,
  EnrollmentStatus,
  FeedImportMode,
  LmsEventType,
  Prisma,
  Role,
  StudentStatus,
} from "@prisma/client";
import type { Request } from "express";
import { z } from "zod";
import { audit } from "../../audit.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
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
  return prisma.$queryRaw<Array<{
    id: string; bookTitle: string; loanedOn: Date; dueOn: Date; returnedOn: Date | null; status: string;
  }>>`
    SELECT id, book_title AS "bookTitle", loaned_on AS "loanedOn", due_on AS "dueOn",
      returned_on AS "returnedOn",
      CASE
        WHEN returned_on IS NOT NULL THEN 'Returned'
        WHEN due_on < CURRENT_DATE THEN 'Overdue'
        ELSE 'Borrowed'
      END AS status
    FROM library_loans
    WHERE student_id = ${student.id}
    ORDER BY loaned_on DESC, id DESC
  `;
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
