import { z } from "zod";
import { seniorHighStrands } from "../../constants/education.js";
import { idSchema } from "../../utils/idSchema.js";

const spaces = (value: string) => value.trim().replace(/\s+/g, " ");
const sectionName = z.string().transform(spaces).pipe(z.string().min(1).max(80));
const strand = z.enum(seniorHighStrands).nullable().optional();
const capacity = z.number().int().min(1).max(200).nullable().optional();

export const listSectionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  schoolYearId: idSchema.optional(),
  gradeLevel: z.coerce.number().int().min(7).max(12).optional(),
  strand: z.enum(seniorHighStrands).optional(),
  search: z.string().optional().transform((value) => (value ? spaces(value) : undefined)),
});

export const createSectionSchema = z.object({
  schoolYearId: idSchema.optional(),
  gradeLevel: z.coerce.number().int().min(7).max(12),
  name: sectionName,
  strand,
  capacity,
  adviserId: idSchema.nullable().optional(),
}).superRefine((value, context) => {
  if (value.gradeLevel >= 11 && !value.strand) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["strand"], message: "Choose a strand for Grade 11 or 12" });
  }
  if (value.gradeLevel < 11 && value.strand) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["strand"], message: "Strands are only available for Grades 11 and 12" });
  }
});

export const updateSectionSchema = z.object({
  name: sectionName.optional(),
  adviserId: idSchema.nullable().optional(),
  schoolYearId: idSchema.optional(),
  gradeLevel: z.coerce.number().int().min(7).max(12).optional(),
  strand,
  capacity,
}).refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "At least one field must be provided",
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
