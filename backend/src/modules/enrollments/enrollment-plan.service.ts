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

function defaultGradeTargets() {
  return [7, 8, 9, 10].map((gradeLevel) => ({
    gradeLevel,
    expectedNew: null,
    expectedReturning: null,
    plannedSections: null,
  }));
}

export async function getEnrollmentPlan(schoolYearId: string) {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  if (!schoolYear) throw new AppError("School year not found", 404);

  const plan = await prisma.enrollmentPlan.findUnique({
    where: { schoolYearId },
    include: {
      strandTargets: { orderBy: [{ gradeLevel: "asc" }, { strand: "asc" }] },
      gradeTargets: { orderBy: { gradeLevel: "asc" } },
    },
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
      gradeTargets: defaultGradeTargets(),
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
    gradeTargets: plan.gradeTargets.length > 0 ? plan.gradeTargets : defaultGradeTargets(),
    updatedAt: plan.updatedAt,
  };
}

export async function getEnrollmentPlanCapacity(schoolYearId: string) {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { id: true },
  });
  if (!schoolYear) throw new AppError("School year not found", 404);

  const [plan, sections, enrollmentCounts] = await Promise.all([
    prisma.enrollmentPlan.findUnique({
      where: { schoolYearId },
      include: {
        strandTargets: { orderBy: [{ gradeLevel: "asc" }, { strand: "asc" }] },
        gradeTargets: { orderBy: { gradeLevel: "asc" } },
      },
    }),
    prisma.section.findMany({
      where: { schoolYearId },
      select: { id: true, gradeLevel: true, strand: true, capacity: true },
    }),
    prisma.enrollment.groupBy({
      by: ["sectionId"],
      where: { schoolYearId, status: "ENROLLED", sectionId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const sectionCounts = new Map(
    enrollmentCounts.flatMap((item) => item.sectionId ? [[item.sectionId, item._count._all] as const] : []),
  );
  const targets = [
    ...(plan?.gradeTargets.length ? plan.gradeTargets : defaultGradeTargets()).map((target) => ({
      gradeLevel: target.gradeLevel,
      strand: null,
      expectedNew: target.expectedNew,
      expectedReturning: target.expectedReturning,
      plannedSections: target.plannedSections,
    })),
    ...(plan?.strandTargets.length ? plan.strandTargets : defaultTargets()).map((target) => ({
      gradeLevel: target.gradeLevel,
      strand: target.strand,
      expectedNew: target.expectedNew,
      expectedReturning: target.expectedReturning,
      plannedSections: target.plannedSections,
    })),
  ];

  return {
    data: targets.map((target) => {
      const matchingSections = sections.filter((section) =>
        section.gradeLevel === target.gradeLevel &&
        (target.strand === null ? section.gradeLevel <= 10 : section.strand === target.strand));
      const enrolled = matchingSections.reduce((sum, section) => sum + (sectionCounts.get(section.id) ?? 0), 0);
      const capacityIsConfigured = matchingSections.length > 0 &&
        matchingSections.every((section) => section.capacity !== null);
      const capacity = capacityIsConfigured
        ? matchingSections.reduce((sum, section) => sum + (section.capacity ?? 0), 0)
        : null;
      const expectedEnrollment = target.expectedNew !== null || target.expectedReturning !== null
        ? (target.expectedNew ?? 0) + (target.expectedReturning ?? 0)
        : null;
      const overCapacity = matchingSections.some((section) =>
        section.capacity !== null && (sectionCounts.get(section.id) ?? 0) > section.capacity);
      const belowTarget = expectedEnrollment !== null && enrolled < expectedEnrollment;
      return {
        gradeLevel: target.gradeLevel,
        strand: target.strand,
        expectedEnrollment,
        enrolled,
        sectionCount: matchingSections.length,
        capacity,
        seatsLeft: capacity === null ? null : Math.max(0, capacity - enrolled),
        overCapacity,
        belowTarget,
      };
    }),
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
  const gradeTargetData = input.gradeTargets.map((target) => ({
    gradeLevel: target.gradeLevel,
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
        gradeTargets: { create: gradeTargetData },
      },
      update: {
        ...dates,
        requirements,
        specialPolicies,
        strandTargets: {
          deleteMany: {},
          create: targetData,
        },
        gradeTargets: {
          deleteMany: {},
          create: gradeTargetData,
        },
      },
      include: {
        strandTargets: { orderBy: [{ gradeLevel: "asc" }, { strand: "asc" }] },
        gradeTargets: { orderBy: { gradeLevel: "asc" } },
      },
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
        gradeTargetCount: input.gradeTargets.length,
      },
      ipAddress: request?.ip,
    }, transaction);
    return saved;
  });
  return getEnrollmentPlan(schoolYearId);
}
