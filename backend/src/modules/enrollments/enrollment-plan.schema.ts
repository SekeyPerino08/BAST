import { z } from "zod";
import { seniorHighStrands } from "../../constants/education.js";

export const enrollmentRequirementCategories = [
  "NEW",
  "RETURNING",
  "TRANSFEREE",
  "SCHOLARSHIP",
  "SUPPORT",
  "INTERNATIONAL",
  "LATE",
] as const;

const nullableCount = z.number().int().min(0).max(100_000).nullable();

const strandTargetSchema = z.object({
  gradeLevel: z.union([z.literal(11), z.literal(12)]),
  strand: z.enum(seniorHighStrands),
  expectedNew: nullableCount,
  expectedReturning: nullableCount,
  plannedSections: nullableCount,
});

const gradeTargetSchema = z.object({
  gradeLevel: z.union([z.literal(7), z.literal(8), z.literal(9), z.literal(10)]),
  expectedNew: nullableCount,
  expectedReturning: nullableCount,
  plannedSections: nullableCount,
});

const requirementSchema = z.object({
  category: z.enum(enrollmentRequirementCategories),
  name: z.string().trim().min(1).max(160),
  required: z.boolean(),
});

const specialPoliciesSchema = z.object({
  transfers: z.string().trim().max(4000),
  scholarships: z.string().trim().max(4000),
  support: z.string().trim().max(4000),
  international: z.string().trim().max(4000),
  lateApplicants: z.string().trim().max(4000),
});

export const enrollmentPlanSchema = z.object({
  registrationOpensAt: z.iso.date().nullable(),
  registrationClosesAt: z.iso.date().nullable(),
  firstDayOfClasses: z.iso.date().nullable(),
  requirements: z.array(requirementSchema).max(100),
  specialPolicies: specialPoliciesSchema,
  targets: z.array(strandTargetSchema).length(10),
  gradeTargets: z.array(gradeTargetSchema).length(4),
}).superRefine((value, context) => {
  if (value.registrationOpensAt && value.registrationClosesAt &&
    value.registrationClosesAt < value.registrationOpensAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["registrationClosesAt"],
      message: "Enrollment closing date must be on or after the opening date",
    });
  }
  const keys = new Set<string>();
  for (const [index, target] of value.targets.entries()) {
    const key = `${target.gradeLevel}:${target.strand}`;
    if (keys.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targets", index],
        message: "Each Grade 11/12 strand must appear exactly once",
      });
    }
    keys.add(key);
  }
  if (keys.size !== 10) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targets"],
      message: "Provide targets for every Grade 11 and 12 strand",
    });
  }
  const gradeKeys = new Set<number>();
  for (const [index, target] of value.gradeTargets.entries()) {
    if (gradeKeys.has(target.gradeLevel)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gradeTargets", index],
        message: "Each Grade 7–10 target must appear exactly once",
      });
    }
    gradeKeys.add(target.gradeLevel);
  }
  if (gradeKeys.size !== 4) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["gradeTargets"],
      message: "Provide targets for every Grade 7 through 10",
    });
  }
});

export type EnrollmentPlanInput = z.infer<typeof enrollmentPlanSchema>;
