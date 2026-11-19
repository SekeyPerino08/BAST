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
});

export type EnrollmentPlanInput = z.infer<typeof enrollmentPlanSchema>;
