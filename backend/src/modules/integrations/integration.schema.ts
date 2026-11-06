import { z } from "zod";

const email = z.string().trim().email().transform((value) => value.toLowerCase()).optional();
const studentNo = z.string().trim().min(1).transform((value) => value.toUpperCase()).optional();
const identity = {
  studentNo,
  email,
  firstName: z.string().trim().transform((value) => value.replace(/\s+/g, " ")).optional(),
  lastName: z.string().trim().transform((value) => value.replace(/\s+/g, " ")).optional(),
};
const externalId = z.string().trim().min(1).max(200);
const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Invalid date");
const eventDate = z.string().trim().datetime({ offset: true });

const identityRule = (row: { studentNo?: string; email?: string }) =>
  Boolean(row.studentNo || row.email);

export const lmsEventSchema = z.object({
  ...identity,
  externalId,
  type: z.enum(["Login", "Submission", "Quiz"]),
  occurredAt: eventDate,
  score: z.number().min(0).max(100).nullable().optional(),
  onTime: z.boolean().nullable().optional(),
  courseCode: z.string().trim().toUpperCase().min(1).optional(),
}).refine(identityRule, { message: "Student number or email is required" });

export const libraryLoanSchema = z.object({
  ...identity,
  externalId,
  bookTitle: z.string().trim().min(1).max(300).transform((value) => value.replace(/\s+/g, " ")),
  loanedOn: dateOnly,
  dueOn: dateOnly,
  returnedOn: dateOnly.nullable().optional(),
}).refine(identityRule, { message: "Student number or email is required" })
  .refine((row) => row.dueOn >= row.loanedOn, {
    message: "Due date cannot be before loan date",
    path: ["dueOn"],
  });

export const alumniRecordSchema = z.object({
  ...identity,
  externalId,
  kind: z.enum(["Donation", "Event", "Mentoring"]),
  amount: z.number().positive().nullable().optional(),
  occurredOn: dateOnly,
  detail: z.string().trim().max(1000).transform((value) => value.replace(/\s+/g, " ")).nullable().optional(),
}).refine(identityRule, { message: "Student number or email is required" });

export const syncParamsSchema = z.object({
  source: z.enum(["lms", "library", "alumni"]),
});

export const syncQuerySchema = z.object({
  mode: z.enum(["preview", "commit"]),
  batch: z.enum(["current", "next"]).default("current"),
});

export const syncHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export type IntegrationSource = z.infer<typeof syncParamsSchema>["source"];
