import { afterEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    schoolYear: { findFirst: vi.fn() },
    student: { count: vi.fn(), groupBy: vi.fn() },
    teacher: { groupBy: vi.fn() },
    enrollment: { count: vi.fn() },
    section: { findMany: vi.fn() },
    classOffering: { findMany: vi.fn() },
    libraryLoan: { count: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));

import { getAdminDashboard } from "../src/modules/dashboard/dashboard.service.js";

describe("admin dashboard account counts", () => {
  afterEach(() => vi.clearAllMocks());

  it("counts NULL userIds without Prisma decoding them as required strings", async () => {
    prismaMock.schoolYear.findFirst.mockResolvedValue(null);
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ activeCount: 4n, withoutLoginCount: 2n }])
      .mockResolvedValueOnce([{ activeCount: 3n, withoutLoginCount: 1n }]);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.section.findMany.mockResolvedValue([]);
    prismaMock.classOffering.findMany.mockResolvedValue([]);
    prismaMock.libraryLoan.count.mockResolvedValue(0);
    prismaMock.auditLog.findMany.mockResolvedValue([]);

    const dashboard = await getAdminDashboard();

    expect(dashboard.counts.activeStudents).toBe(4);
    expect(dashboard.counts.activeTeachers).toBe(3);
    expect(dashboard.counts.accountsWithoutLogin).toEqual({ students: 2, teachers: 1 });
    expect(prismaMock.student.groupBy).not.toHaveBeenCalled();
    expect(prismaMock.teacher.groupBy).not.toHaveBeenCalled();
  });
});
