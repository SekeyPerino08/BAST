import { afterEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    student: { findUnique: vi.fn() },
    schoolYear: { findUnique: vi.fn() },
    term: { findMany: vi.fn() },
    classOffering: { findMany: vi.fn() },
    grade: { findMany: vi.fn() },
    attendance: { findMany: vi.fn() },
  },
}));

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));

import { Role } from "@prisma/client";
import { getStudentReportCard } from "../src/modules/report-cards/report-cards.service.js";

describe("report card attendance date boundary", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("uses the current Manila calendar date instead of the server UTC date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T18:00:00.000Z"));

    prismaMock.schoolYear.findUnique
      .mockResolvedValueOnce({ id: "schoolyear1" })
      .mockResolvedValueOnce({ id: "schoolyear1", name: "2025-2026" });
    prismaMock.student.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "student-1",
        studentNo: "student-1",
        firstName: "Test",
        middleName: null,
        lastName: "Student",
        sex: "FEMALE",
        birthDate: new Date("2010-01-01T00:00:00.000Z"),
        enrollments: [{
          status: "ENROLLED",
          section: {
            id: "section-1",
            gradeLevel: 10,
            name: "Grade 10",
            adviser: null,
          },
        }],
      });
    prismaMock.term.findMany.mockResolvedValue([]);
    prismaMock.classOffering.findMany.mockResolvedValue([]);
    prismaMock.grade.findMany.mockResolvedValue([]);
    prismaMock.attendance.findMany.mockResolvedValue([]);

    await getStudentReportCard(
      "student-1",
      "schoolyear1",
      { schoolYearId: "schoolyear1" },
      { id: "admin-1", role: Role.ADMIN },
    );

    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        date: { lte: new Date("2026-01-02T00:00:00.000Z") },
      }),
    }));
  });
});
