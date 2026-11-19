import { Sex } from "@prisma/client";
import { z } from "zod";
import { idSchema } from "../../utils/idSchema.js";

const normalizeOptionalString = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const profileName = z.preprocess(
  (value) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value,
  z.string()
    .min(2, "Enter at least 2 characters")
    .max(50, "Use 50 characters or fewer")
    .regex(/^[\p{L}]+(?:[ '-\u2019][\p{L}]+)*$/u, "Use letters, spaces, hyphens, or apostrophes only"),
);

const profilePhone = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const normalized = value.trim().replace(/[ ()-]/g, "");
    return normalized || null;
  },
  z.string()
    .regex(/^(?:09\d{9}|\+639\d{9})$/, "Use a Philippine number such as 09171234567 or +639171234567")
    .nullable(),
);

function isValidBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;

  const today = new Date();
  const latestBirthDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  latestBirthDate.setUTCFullYear(latestBirthDate.getUTCFullYear() - 5);
  return date <= latestBirthDate;
}

export const updateMyProfileSchema = z.object({
  firstName: profileName,
  middleName: z.preprocess(normalizeOptionalString, profileName.nullable()),
  lastName: profileName,
  phoneNumber: profilePhone,
  dateOfBirth: z.preprocess(
    normalizeOptionalString,
    z.string().refine(isValidBirthDate, "Enter a valid date at least 5 years ago").nullable(),
  ),
  sex: z.preprocess(normalizeOptionalString, z.nativeEnum(Sex).nullable()),
  address: z.preprocess(
    normalizeOptionalString,
    z.string().trim().max(300, "Use 300 characters or fewer").nullable(),
  ),
  removePhoto: z.preprocess((value) => value === "true" || value === true, z.boolean()),
}).strict();

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

export const myClassesQuerySchema = z.object({
  schoolYearId: idSchema.optional(),
});
