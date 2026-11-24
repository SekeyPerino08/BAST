import { SeniorHighStrand } from "@prisma/client";
import { z } from "zod";
import { createStudentSchema } from "../students/student.schema.js";
import { idSchema } from "../../utils/idSchema.js";

const applicantFields = {
  firstName: z.string().trim().min(1).max(60),
  middleName: z.string().trim().max(60).nullable().optional(),
  lastName: z.string().trim().min(1).max(60),
  gradeLevel: z.union([z.literal(7), z.literal(8), z.literal(9), z.literal(10), z.literal(11), z.literal(12)]),
  strand: z.nativeEnum(SeniorHighStrand).nullable().optional(),
  guardianName: z.string().trim().max(120).nullable().optional(),
  guardianContact: z.string().trim().max(30).nullable().optional(),
};

export const createApplicantSchema = z.object(applicantFields).superRefine((applicant, context) => {
  const isSeniorHigh = applicant.gradeLevel >= 11;
  if (isSeniorHigh !== Boolean(applicant.strand)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["strand"],
      message: isSeniorHigh ? "Choose a strand for Grade 11 or 12" : "Junior High applicants do not have a strand",
    });
  }
});

export const updateApplicantDocumentsSchema = z.object({
  documents: z.array(z.object({
    id: z.string().min(1).max(120),
    received: z.boolean(),
  })).max(100),
});

export const advanceApplicantSchema = z.object({
  stage: z.enum(["REVIEW", "ACCEPTED", "ENROLLMENT"]),
});

export const enrollApplicantSchema = z.object({
  sectionId: idSchema,
  student: createStudentSchema,
});

export const listApplicantsQuerySchema = z.object({
  schoolYearId: idSchema.optional(),
});

export type CreateApplicantInput = z.infer<typeof createApplicantSchema>;
export type EnrollApplicantInput = z.infer<typeof enrollApplicantSchema>;
