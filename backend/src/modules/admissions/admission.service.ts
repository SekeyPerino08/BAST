import { AdmissionStage, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { z } from "zod";
import { audit } from "../../audit.js";
import { prisma } from "../../lib/prisma.js";
import { createLinkedPersonUser } from "../../services/account.service.js";
import { AppError } from "../../utils/AppError.js";
import { invalidateAdminDashboardCache } from "../dashboard/dashboard.helpers.js";
import { enrollOne } from "../enrollments/enrollment.service.js";
import {
  advanceApplicantSchema,
  createApplicantSchema,
  enrollApplicantSchema,
  listApplicantsQuerySchema,
  updateApplicantDocumentsSchema,
  type CreateApplicantInput,
} from "./admission.schema.js";

const documentsSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  required: z.boolean(),
  received: z.boolean(),
}));
type AuditContext = {
  user: NonNullable<Request["user"]>;
  ip: string | undefined;
};

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      errors: result.error.flatten().fieldErrors,
    });
  }
  return result.data;
}

function parsedDocuments(value: Prisma.JsonValue) {
  const result = documentsSchema.safeParse(value);
  if (!result.success) throw new AppError("Applicant checklist data is invalid", 500);
  return result.data;
}

async function defaultDocuments(schoolYearId: string) {
  const plan = await prisma.enrollmentPlan.findUnique({
    where: { schoolYearId },
    select: { requirements: true },
  });
  if (!Array.isArray(plan?.requirements)) return [];
  return plan.requirements.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const requirement = item as Record<string, unknown>;
    if (requirement.category !== "NEW" || requirement.required !== true || typeof requirement.name !== "string") return [];
    return [{ id: `document-${index}`, name: requirement.name, required: true, received: false }];
  });
}

export async function listApplicants(rawQuery: unknown) {
  const query = parse(listApplicantsQuerySchema, rawQuery);
  const schoolYearId = query.schoolYearId ?? (await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  }))?.id;
  if (!schoolYearId) throw new AppError("No current school year is configured", 404, "NO_CURRENT_SCHOOL_YEAR");
  const data = await prisma.applicant.findMany({
    where: { schoolYearId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      schoolYearId: true,
      firstName: true,
      middleName: true,
      lastName: true,
      gradeLevel: true,
      strand: true,
      guardianName: true,
      guardianContact: true,
      documents: true,
      stage: true,
      studentId: true,
      createdAt: true,
      updatedAt: true,
      student: { select: { studentNo: true } },
    },
  });
  return { data: data.map((item) => ({ ...item, documents: parsedDocuments(item.documents) })) };
}

export async function createApplicant(rawInput: unknown, request: AuditContext) {
  const input: CreateApplicantInput = parse(createApplicantSchema, rawInput);
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });
  if (!schoolYear) throw new AppError("No current school year is configured", 404, "NO_CURRENT_SCHOOL_YEAR");
  const documents = await defaultDocuments(schoolYear.id);

  const applicant = await prisma.$transaction(async (transaction) => {
    const created = await transaction.applicant.create({
      data: {
        schoolYearId: schoolYear.id,
        ...input,
        documents,
      },
    });
    await audit(transaction, request, {
      action: "ADMISSION_CREATED",
      entityType: "Applicant",
      entityId: created.id,
      after: { gradeLevel: created.gradeLevel, strand: created.strand, stage: created.stage },
    });
    return created;
  });
  return { ...applicant, documents: parsedDocuments(applicant.documents) };
}

export async function updateApplicantDocuments(id: string, rawInput: unknown, request: AuditContext) {
  const input = parse(updateApplicantDocumentsSchema, rawInput);
  return prisma.$transaction(async (transaction) => {
    const applicant = await transaction.applicant.findUnique({ where: { id } });
    if (!applicant) throw new AppError("Applicant not found", 404, "APPLICANT_NOT_FOUND");
    if (applicant.stage !== AdmissionStage.DOCUMENT_COLLECTION) {
      throw new AppError("Documents can only be updated during document collection", 409, "ADMISSION_STAGE_CLOSED");
    }
    const documents = parsedDocuments(applicant.documents);
    if (input.documents.length !== documents.length ||
      new Set(input.documents.map(({ id: documentId }) => documentId)).size !== documents.length ||
      input.documents.some(({ id: documentId }) => !documents.some((document) => document.id === documentId))) {
      throw new AppError("Checklist items have changed. Refresh and try again.", 409, "CHECKLIST_CHANGED");
    }
    const updatedDocuments = documents.map((document) => ({
      ...document,
      received: input.documents.find(({ id: documentId }) => documentId === document.id)?.received ?? false,
    }));
    const updated = await transaction.applicant.update({
      where: { id },
      data: { documents: updatedDocuments },
    });
    await audit(transaction, request, {
      action: "ADMISSION_DOCUMENTS_UPDATED",
      entityType: "Applicant",
      entityId: id,
      after: { receivedCount: updatedDocuments.filter(({ received }) => received).length },
    });
    return { ...updated, documents: updatedDocuments };
  });
}

export async function advanceApplicant(id: string, rawInput: unknown, request: AuditContext) {
  const input = parse(advanceApplicantSchema, rawInput);
  const nextStage = input.stage as AdmissionStage;
  return prisma.$transaction(async (transaction) => {
    const applicant = await transaction.applicant.findUnique({ where: { id } });
    if (!applicant) throw new AppError("Applicant not found", 404, "APPLICANT_NOT_FOUND");
    const allowedNextStage: Partial<Record<AdmissionStage, AdmissionStage>> = {
      [AdmissionStage.DOCUMENT_COLLECTION]: AdmissionStage.REVIEW,
      [AdmissionStage.REVIEW]: AdmissionStage.ACCEPTED,
      [AdmissionStage.ACCEPTED]: AdmissionStage.ENROLLMENT,
    };
    if (allowedNextStage[applicant.stage] !== nextStage) {
      throw new AppError("Applicants must move through each admissions stage in order", 409, "INVALID_ADMISSION_TRANSITION");
    }
    if (applicant.stage === AdmissionStage.DOCUMENT_COLLECTION) {
      const documents = parsedDocuments(applicant.documents);
      if (documents.some((document) => document.required && !document.received)) {
        throw new AppError("Collect all required documents before review", 409, "DOCUMENTS_INCOMPLETE");
      }
    }
    const updated = await transaction.applicant.update({ where: { id }, data: { stage: nextStage } });
    await audit(transaction, request, {
      action: "ADMISSION_STAGE_CHANGED",
      entityType: "Applicant",
      entityId: id,
      before: { stage: applicant.stage },
      after: { stage: updated.stage },
    });
    return updated;
  });
}

export async function enrollApplicant(id: string, rawInput: unknown, request: AuditContext) {
  const input = parse(enrollApplicantSchema, rawInput);
  const { confirmDuplicate, ...studentData } = input.student;
  const section = await prisma.section.findUnique({
    where: { id: input.sectionId },
    select: { id: true, name: true, gradeLevel: true, strand: true, schoolYearId: true },
  });
  if (!section) throw new AppError("Section not found", 404);

  const result = await prisma.$transaction(async (transaction) => {
    const applicant = await transaction.applicant.findUnique({ where: { id } });
    if (!applicant) throw new AppError("Applicant not found", 404, "APPLICANT_NOT_FOUND");
    if (applicant.stage !== AdmissionStage.ENROLLMENT || applicant.studentId) {
      throw new AppError("Only accepted applicants in the Enrollment stage can be enrolled", 409, "INVALID_ADMISSION_STAGE");
    }
    if (section.schoolYearId !== applicant.schoolYearId ||
      section.gradeLevel !== applicant.gradeLevel ||
      (applicant.strand !== section.strand)) {
      throw new AppError("Choose a section that matches the applicant's school year, grade, and strand", 400, "SECTION_MISMATCH");
    }
    const finalStudentData = {
      ...studentData,
      firstName: applicant.firstName,
      middleName: applicant.middleName,
      lastName: applicant.lastName,
      guardianName: applicant.guardianName,
      guardianContact: applicant.guardianContact,
    };
    const existingStudent = await transaction.student.findUnique({
      where: { studentNo: finalStudentData.studentNo },
      select: { id: true },
    });
    if (existingStudent) throw new AppError("A student with this student number already exists", 409, "STUDENT_NO_EXISTS");
    const birthDateStart = new Date(Date.UTC(
      finalStudentData.birthDate.getUTCFullYear(),
      finalStudentData.birthDate.getUTCMonth(),
      finalStudentData.birthDate.getUTCDate(),
    ));
    const possibleDuplicates = await transaction.student.findMany({
      where: {
        firstName: { equals: finalStudentData.firstName, mode: "insensitive" },
        lastName: { equals: finalStudentData.lastName, mode: "insensitive" },
        birthDate: { gte: birthDateStart, lt: new Date(birthDateStart.getTime() + 86_400_000) },
      },
      select: { id: true, studentNo: true, firstName: true, lastName: true },
    });
    if (possibleDuplicates.length && !confirmDuplicate) {
      throw new AppError("A possible matching student was found", 409, "POSSIBLE_DUPLICATE", { matches: possibleDuplicates });
    }

    const studentId = randomUUID();
    const user = await createLinkedPersonUser(transaction, {
      kind: "student",
      personId: studentId,
      personNumber: finalStudentData.studentNo,
      firstName: finalStudentData.firstName,
      lastName: finalStudentData.lastName,
      isActive: true,
    });
    const student = await transaction.student.create({ data: { ...finalStudentData, id: studentId, userId: user.id } });
    const enrollment = await enrollOne(transaction, student.id, section);
    const updatedApplicant = await transaction.applicant.update({
      where: { id },
      data: { stage: AdmissionStage.ENROLLED, studentId: student.id },
    });
    await audit(transaction, request, {
      action: "ADMISSION_ENROLLED",
      entityType: "Applicant",
      entityId: id,
      studentId: student.id,
      after: { stage: updatedApplicant.stage, studentId: student.id, sectionId: section.id },
    });
    return {
      applicant: updatedApplicant,
      student: { id: student.id, studentNo: student.studentNo },
      enrollment: { id: enrollment.id, section: section.name, gradeLevel: section.gradeLevel },
      accountEmail: user.email,
    };
  });
  invalidateAdminDashboardCache();
  return result;
}
