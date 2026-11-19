import { z } from "zod";
import { seniorHighStrands } from "../enrollment/types";
export const sectionSchema = z.object({
  schoolYearId: z.string().optional(),
  gradeLevel: z.coerce.number().int().min(7).max(12),
  name: z.string().trim().min(1, "Section name is required").max(80).transform((value) => value.replace(/\s+/g, " ")),
  strand: z.preprocess((value) => value === "" ? null : value, z.enum(seniorHighStrands).nullable()),
  capacity: z.preprocess(
    (value) => value === "" || value === undefined || value === null ? null : Number(value),
    z.number().int().min(1, "Capacity must be at least one").max(200).nullable(),
  ),
  adviserId: z.string().nullable().optional(),
}).superRefine((value, context) => {
  if (value.gradeLevel >= 11 && !value.strand) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["strand"], message: "Choose a strand for Grade 11 or 12" });
  }
  if (value.gradeLevel < 11 && value.strand) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["strand"], message: "Strands are only available for Grades 11 and 12" });
  }
});
