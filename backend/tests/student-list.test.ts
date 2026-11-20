import { afterEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    student: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));

import { listStudents } from "../src/modules/students/student.service.js";

describe("student list without login accounts", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns students with a NULL userId", async () => {
    const student = {
      id: "student-1",
      studentNo: "STU-001",
      userId: null,
      firstName: "Alex",
      middleName: null,
      lastName: "Rivera",
      sex: "FEMALE",
      birthDate: null,
      address: null,
      guardianName: null,
      guardianContact: null,
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      enrollments: [],
    };
    prismaMock.$transaction.mockResolvedValueOnce([[student], 1]);

    const result = await listStudents({});

    expect(result.data).toHaveLength(1);
    expect(result.data[0].userId).toBeNull();
    expect(result.data[0].currentEnrollment).toBeNull();
  });
});
