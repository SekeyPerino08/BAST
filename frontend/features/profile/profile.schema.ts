import { z } from "zod";

const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const profileName = z.preprocess(
  (value) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value,
  z.string()
    .min(2, "Enter at least 2 characters")
    .max(50, "Use 50 characters or fewer")
    .regex(/^[\p{L}]+(?:[ '-\u2019][\p{L}]+)*$/u, "Use letters, spaces, hyphens, or apostrophes only"),
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

export const personalProfileSchema = z.object({
  firstName: profileName,
  middleName: z.preprocess(optionalText, profileName.nullable()),
  lastName: profileName,
  phoneNumber: z.preprocess(
    (value) => typeof value === "string" ? value.trim().replace(/[ ()-]/g, "") || null : value,
    z.string()
      .regex(/^(?:09\d{9}|\+639\d{9})$/, "Use a Philippine number such as 09171234567 or +639171234567")
      .nullable(),
  ),
  dateOfBirth: z.preprocess(
    optionalText,
    z.string().refine(isValidBirthDate, "Enter a valid date at least 5 years ago").nullable(),
  ),
  sex: z.preprocess(optionalText, z.enum(["MALE", "FEMALE"]).nullable()),
  address: z.preprocess(optionalText, z.string().trim().max(300, "Use 300 characters or fewer").nullable()),
});

export type PersonalProfileFormInput = z.input<typeof personalProfileSchema>;
export type PersonalProfileValues = z.output<typeof personalProfileSchema>;
