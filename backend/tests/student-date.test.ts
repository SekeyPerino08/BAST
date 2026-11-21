import { afterEach, describe, expect, it, vi } from "vitest";
import { createStudentSchema } from "../src/modules/students/student.schema.js";
import { updateMyProfileSchema } from "../src/modules/me/me.schema.js";

describe("Manila birth-date boundaries", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the Manila calendar date for student age validation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T18:00:00.000Z"));

    const student = (birthDate: string) => createStudentSchema.safeParse({
      studentNo: "STU-001",
      firstName: "Test",
      lastName: "Student",
      sex: "FEMALE",
      birthDate,
    });

    expect(student("2021-01-03").success).toBe(true);
    expect(student("2021-01-04").success).toBe(false);
    expect(student("2026-02-31").success).toBe(false);
    expect(updateMyProfileSchema.safeParse({
      firstName: "Test",
      middleName: null,
      lastName: "Student",
      phoneNumber: null,
      dateOfBirth: "2021-01-03",
      sex: "FEMALE",
      address: null,
      removePhoto: false,
    }).success).toBe(true);
  });
});
