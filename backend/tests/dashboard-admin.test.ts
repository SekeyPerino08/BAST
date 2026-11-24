import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    schoolYear: { findFirst: vi.fn() },
    student: { count: vi.fn(), groupBy: vi.fn() },
    teacher: { groupBy: vi.fn() },
    enrollment: { count: vi.fn() },
    section: { findMany: vi.fn() },
    classOffering: { findMany: vi.fn() },
    libraryLoan: { count: vi.fn(), findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));

import { getAdminDashboard } from "../src/modules/dashboard/dashboard.service.js";
import { invalidateAdminDashboardCache } from "../src/modules/dashboard/dashboard.helpers.js";

describe("admin dashboard account counts", () => {
  beforeEach(() => invalidateAdminDashboardCache());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function configureEmptySchoolYear() {
    prismaMock.schoolYear.findFirst.mockResolvedValue(null);
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ activeCount: 4n, withoutLoginCount: 2n }])
      .mockResolvedValueOnce([{ activeCount: 3n, withoutLoginCount: 1n }]);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.section.findMany.mockResolvedValue([]);
    prismaMock.classOffering.findMany.mockResolvedValue([]);
    prismaMock.libraryLoan.findMany.mockResolvedValue([]);
    prismaMock.auditLog.findMany.mockResolvedValue([]);
  }

  it("counts NULL userIds without Prisma decoding them as required strings", async () => {
    configureEmptySchoolYear();

    const dashboard = await getAdminDashboard();

    expect(dashboard.counts.activeStudents).toBe(4);
    expect(dashboard.counts.activeTeachers).toBe(3);
    expect(dashboard.counts.accountsWithoutLogin).toEqual({ students: 2, teachers: 1 });
    expect(prismaMock.student.groupBy).not.toHaveBeenCalled();
    expect(prismaMock.teacher.groupBy).not.toHaveBeenCalled();
  });

  it("calculates both active-loan counts from one query using the Manila date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T12:00:00.000Z"));
    configureEmptySchoolYear();
    prismaMock.libraryLoan.findMany.mockResolvedValue([
      { dueOn: new Date("2026-11-19T00:00:00.000Z"), returnedOn: null },
      { dueOn: new Date("2026-11-19T00:00:00.000Z"), returnedOn: null },
      { dueOn: new Date("2026-11-20T00:00:00.000Z"), returnedOn: null },
      { dueOn: new Date("2026-11-21T00:00:00.000Z"), returnedOn: null },
      { dueOn: new Date("2026-11-18T00:00:00.000Z"), returnedOn: new Date("2026-11-19T00:00:00.000Z") },
    ]);

    const dashboard = await getAdminDashboard();

    expect(dashboard.libraryLoans).toEqual({ borrowed: 2, overdue: 2 });
    expect(prismaMock.libraryLoan.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.libraryLoan.findMany).toHaveBeenCalledWith({
      where: { returnedOn: null },
      select: { dueOn: true, returnedOn: true },
    });
  });

  it("recomputes dashboard aggregates after a write invalidates the cache", async () => {
    configureEmptySchoolYear();
    const before = await getAdminDashboard();
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ activeCount: 5n, withoutLoginCount: 1n }])
      .mockResolvedValueOnce([{ activeCount: 3n, withoutLoginCount: 1n }]);

    invalidateAdminDashboardCache();
    const after = await getAdminDashboard();

    expect(before.counts.activeStudents).toBe(4);
    expect(after.counts.activeStudents).toBe(5);
  });
});
