import { Prisma } from "@prisma/client";
import type { Request } from "express";
import { seniorHighStrands } from "../../constants/education.js";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../services/audit.service.js";
import { AppError } from "../../utils/AppError.js";
import type { EnrollmentPlanInput } from "./enrollment-plan.schema.js";

const emptyPolicies = {
  transfers: "",
  scholarships: "",
  support: "",
  international: "",
  lateApplicants: "",
};

function dateValue(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function defaultTargets() {
  return [11, 12].flatMap((gradeLevel) => seniorHighStrands.map((strand) => ({
    gradeLevel,
    strand,
    expectedNew: null,
    expectedReturning: null,
    plannedSections: null,
  })));
}

export async function getEnrollmentPlan(schoolYearId: string) {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  if (!schoolYear) throw new AppError("School year not found", 404);

  const plan = await prisma.enrollmentPlan.findUnique({
    where: { schoolYearId },
    include: { strandTargets: { orderBy: [{ gradeLevel: "asc" }, { strand: "asc" }] } },
  });
  if (!plan) {
    return {
      id: null,
      schoolYear,
      registrationOpensAt: null,
      registrationClosesAt: null,
      firstDayOfClasses: null,
      modality: "HYBRID" as const,
      paymentMethod: "CASH" as const,
      requirements: [],
      specialPolicies: emptyPolicies,
      targets: defaultTargets(),
      updatedAt: null,
    };
  }

  return {
    id: plan.id,
    schoolYear,
    registrationOpensAt: plan.registrationOpensAt,
    registrationClosesAt: plan.registrationClosesAt,
    firstDayOfClasses: plan.firstDayOfClasses,
    modality: plan.modality,
    paymentMethod: plan.paymentMethod,
    requirements: plan.requirements,
    specialPolicies: plan.specialPolicies,
    targets: plan.strandTargets,
    updatedAt: plan.updatedAt,
  };
}

export async function saveEnrollmentPlan(
  schoolYearId: string,
  input: EnrollmentPlanInput,
  request?: Request,
) {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { id: true, name: true },
  });
  if (!schoolYear) throw new AppError("School year not found", 404);

  const targetData = input.targets.map((target) => ({
    gradeLevel: target.gradeLevel,
    strand: target.strand,
    expectedNew: target.expectedNew,
    expectedReturning: target.expectedReturning,
    plannedSections: target.plannedSections,
  }));
  const requirements = input.requirements as Prisma.InputJsonValue;
  const specialPolicies = input.specialPolicies as Prisma.InputJsonValue;
  const dates = {
    registrationOpensAt: dateValue(input.registrationOpensAt),
    registrationClosesAt: dateValue(input.registrationClosesAt),
    firstDayOfClasses: dateValue(input.firstDayOfClasses),
  };

  await prisma.$transaction(async (transaction) => {
    const saved = await transaction.enrollmentPlan.upsert({
      where: { schoolYearId },
      create: {
        schoolYearId,
        ...dates,
        modality: "HYBRID",
        paymentMethod: "CASH",
        requirements,
        specialPolicies,
        strandTargets: { create: targetData },
      },
      update: {
        ...dates,
        requirements,
        specialPolicies,
        strandTargets: {
          deleteMany: {},
          create: targetData,
        },
      },
      include: { strandTargets: { orderBy: [{ gradeLevel: "asc" }, { strand: "asc" }] } },
    });

    await logAudit({
      userId: request?.user?.id,
      action: "UPDATE",
      entity: "EnrollmentPlan",
      entityId: saved.id,
      details: {
        schoolYearId,
        registrationOpensAt: input.registrationOpensAt,
        registrationClosesAt: input.registrationClosesAt,
        firstDayOfClasses: input.firstDayOfClasses,
        requirementCount: input.requirements.length,
        targetCount: input.targets.length,
      },
      ipAddress: request?.ip,
    }, transaction);
    return saved;
  });
  return getEnrollmentPlan(schoolYearId);
}
