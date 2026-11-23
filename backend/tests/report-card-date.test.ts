import { afterEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    student: { findUnique: vi.fn() },
    schoolYear: { findUnique: vi.fn() },
    enrollment: { findFirst: vi.fn(), findMany: vi.fn() },
    term: { findMany: vi.fn() },
    classOffering: { findMany: vi.fn() },
    grade: { findMany: vi.fn() },
    attendance: { findMany: vi.fn() },
  },
}));

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));

import { Role } from "@prisma/client";
import {
  getAvailableSchoolYearsForUser,
  getMyStudentReportCard,
  getStudentReportCard,
} from "../src/modules/report-cards/report-cards.service.js";

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

  it("resolves the signed-in student's user ID before loading their report card", async () => {
    prismaMock.schoolYear.findUnique
      .mockResolvedValueOnce({ id: "schoolyear1" })
      .mockResolvedValueOnce({ id: "schoolyear1", name: "2025-2026" });
    prismaMock.student.findUnique
      .mockResolvedValueOnce({ id: "student-1" })
      .mockResolvedValueOnce({
        id: "student-1",
        studentNo: "STU-1",
        firstName: "Test",
        middleName: null,
        lastName: "Student",
        sex: "FEMALE",
        birthDate: null,
        enrollments: [{
          status: "ENROLLED",
          section: {
            id: "section-1",
            gradeLevel: 10,
            name: "Grade 10",
            adviser: null,
          },
        }],
      })
      .mockResolvedValueOnce({ userId: "user-1" });
    prismaMock.enrollment.findFirst.mockResolvedValue({ id: "enrollment-1" });
    prismaMock.term.findMany.mockResolvedValue([]);
    prismaMock.classOffering.findMany.mockResolvedValue([]);
    prismaMock.grade.findMany.mockResolvedValue([]);
    prismaMock.attendance.findMany.mockResolvedValue([]);

    const reportCard = await getMyStudentReportCard(
      "user-1",
      "schoolyear1",
      { schoolYearId: "schoolyear1" },
      { id: "user-1", role: Role.STUDENT },
    );

    expect(reportCard.student.id).toBe("student-1");
    expect(prismaMock.student.findUnique).toHaveBeenNthCalledWith(1, {
      where: { userId: "user-1" },
      select: { id: true },
    });
  });

  it("loads available school years using the linked student ID", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ id: "student-1" });
    prismaMock.enrollment.findMany.mockResolvedValue([
      { schoolYear: { id: "schoolyear1", name: "2025-2026" } },
    ]);

    await expect(getAvailableSchoolYearsForUser("user-1")).resolves.toEqual([
      { id: "schoolyear1", name: "2025-2026" },
    ]);
    expect(prismaMock.student.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { id: true },
    });
    expect(prismaMock.enrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: "student-1" },
    }));
  });
});
