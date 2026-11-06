import { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { audit } from "../../audit.js";
import { AppError } from "../../utils/AppError.js";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination.js";
import { listSubjectsQuerySchema, type CreateSubjectInput, type UpdateSubjectInput } from "./subject.schema.js";

function isKnownError(error: unknown, code: string): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function handleSubjectError(error: unknown): never {
  if (isKnownError(error, "P2025")) throw new AppError("Subject not found", 404);
  if (isKnownError(error, "P2002")) throw new AppError("A subject with this code already exists", 409, "SUBJECT_CODE_EXISTS");
  if (isKnownError(error, "P2003")) throw new AppError("Subject is used by one or more classes and cannot be deleted", 409, "SUBJECT_IN_USE");
  throw error;
}

function auditDiff(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(after)
      .filter(([key, value]) => before[key] !== value)
      .map(([key, value]) => [key, { before: before[key] ?? null, after: value ?? null }]),
  ) as Prisma.InputJsonObject;
}

export async function listSubjects(rawQuery: unknown) {
  const parsed = listSubjectsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten().fieldErrors });
  const query = parsed.data;
  const { skip, take } = parsePagination(query);
  const where: Prisma.SubjectWhereInput = {
    ...(query.gradeLevel === undefined ? {} : { gradeLevel: query.gradeLevel }),
    ...(query.search
      ? { OR: [
          { code: { contains: query.search, mode: "insensitive" } },
          { name: { contains: query.search, mode: "insensitive" } },
        ] }
      : {}),
  };
  const [subjects, total] = await prisma.$transaction([
    prisma.subject.findMany({
      where,
      skip,
      take,
      orderBy: [{ [query.sortBy]: query.order }, { id: "asc" }],
      include: { _count: { select: { classOfferings: true } } },
    }),
    prisma.subject.count({ where }),
  ]);
  return { data: subjects, meta: buildPaginationMeta(query.page, query.pageSize, total) };
}

export async function getSubjectById(id: string) {
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: { _count: { select: { classOfferings: true } } },
  });
  if (!subject) throw new AppError("Subject not found", 404);
  return subject;
}

export async function createSubject(input: CreateSubjectInput, request?: Request) {
  try {
    const subject = await prisma.$transaction(async (transaction) => {
      const created = await transaction.subject.create({ data: input });
      if (request) {
        await audit(transaction, request, {
          action: "CREATE",
          entityType: "Course",
          entityId: created.id,
          after: input,
        });
      }
      return created;
    });
    return subject;
  } catch (error) {
    handleSubjectError(error);
  }
}

export async function updateSubject(id: string, input: UpdateSubjectInput, request?: Request) {
  try {
    const subject = await prisma.$transaction(async (transaction) => {
      const before = await transaction.subject.findUnique({ where: { id } });
      if (!before) throw new AppError("Subject not found", 404);
      const updated = await transaction.subject.update({ where: { id }, data: input });
      if (request) {
        const changes = auditDiff(
          before as unknown as Record<string, unknown>,
          input as Record<string, unknown>,
        );
        const beforeValues = Object.fromEntries(
          Object.keys(changes).map((key) => [key, before[key as keyof typeof before] ?? null]),
        );
        await audit(transaction, request, {
          action: "UPDATE",
          entityType: "Course",
          entityId: id,
          before: beforeValues,
          after: input,
        });
      }
      return updated;
    });
    return subject;
  } catch (error) {
    handleSubjectError(error);
  }
}

export async function deleteSubject(id: string, request?: Request) {
  try {
    const subject = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.subject.findUnique({ where: { id } });
      if (!existing) throw new AppError("Subject not found", 404);
      const offeringCount = await transaction.classOffering.count({ where: { subjectId: id } });
      if (offeringCount) {
        throw new AppError(`This subject is used by ${offeringCount} classes and cannot be deleted`, 409, "SUBJECT_IN_USE", { count: offeringCount });
      }
      const deleted = await transaction.subject.delete({ where: { id } });
      if (request) {
        await audit(transaction, request, {
          action: "DELETE",
          entityType: "Course",
          entityId: id,
          before: { code: existing.code, name: existing.name },
        });
      }
      return deleted;
    });
    return subject;
  } catch (error) {
    if (isKnownError(error, "P2003")) {
      const classCount = await prisma.classOffering.count({ where: { subjectId: id } });
      throw new AppError(
        `This subject is used by ${classCount} classes and cannot be deleted`,
        409,
        "SUBJECT_IN_USE",
        { count: classCount },
      );
    }
    handleSubjectError(error);
  }
}
