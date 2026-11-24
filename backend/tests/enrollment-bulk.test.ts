import express from "express";
import type { Request, Response, NextFunction } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../src/middleware/errorHandler.js";

const { prismaMocks, transactionMocks } = vi.hoisted(() => ({
  prismaMocks: {
    $transaction: vi.fn(),
    section: { findUnique: vi.fn() },
    schoolYear: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn(), count: vi.fn() },
  },
  transactionMocks: {
    $queryRaw: vi.fn(),
    section: { findUnique: vi.fn() },
    student: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditEntry: { create: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMocks }));
vi.mock("../src/middleware/authenticate.js", () => ({
  authenticate: (req: Request, res: Response, next: NextFunction) => {
    if (req.get("x-test-auth") === "missing") {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    const role = req.get("x-test-role") ?? "ADMIN";
    req.user = {
      id: "test-admin",
      email: "admin@example.test",
      role: role as "ADMIN" | "TEACHER" | "STUDENT" | "ALUMNI",
    };
    next();
  },
}));

import enrollmentRouter from "../src/modules/enrollments/enrollment.routes.js";

const sectionId = "section-id-123";
const schoolYearId = "school-year-123";
const studentIds = ["student-id-001", "student-id-002", "student-id-003"];
const section = {
  id: sectionId,
  name: "GAS 12-A",
  gradeLevel: 12,
  schoolYearId,
  capacity: null as number | null,
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/enrollments", enrollmentRouter);
  app.use(errorHandler);
  return app;
}

function makeStudent(id: string) {
  return { id, status: "ACTIVE" };
}

function configureBulkMocks(
  students: Array<{ id: string; status: string }>,
  options: { capacity?: number | null; enrolledCount?: number; existing?: Array<{ id: string; studentId: string; status: string }> } = {},
) {
  prismaMocks.section.findUnique.mockResolvedValue(section);
  prismaMocks.$transaction.mockImplementation(
    async (operation: (transaction: typeof transactionMocks) => Promise<unknown>) => operation(transactionMocks),
  );
  transactionMocks.$queryRaw.mockResolvedValue([{ pg_advisory_xact_lock: "" }]);
  transactionMocks.section.findUnique.mockResolvedValue({ ...section, capacity: options.capacity ?? null });
  transactionMocks.student.findMany.mockResolvedValue(students);
  transactionMocks.enrollment.findMany.mockResolvedValue(options.existing ?? []);
  transactionMocks.enrollment.count.mockResolvedValue(options.enrolledCount ?? 0);
  transactionMocks.enrollment.create.mockImplementation(async ({ data }: {
    data: { studentId: string; sectionId: string; schoolYearId: string };
  }) => ({
    id: `enrollment-${data.studentId}`,
    ...data,
    status: "ENROLLED",
    student: students.find((student) => student.id === data.studentId),
    section: { id: sectionId, name: section.name, gradeLevel: section.gradeLevel },
    schoolYear: { id: schoolYearId, name: "2025-2026" },
  }));
  transactionMocks.enrollment.update.mockImplementation(async ({ where, data }: {
    where: { id: string };
    data: { studentId?: string; sectionId: string; status: string; enrolledAt: Date };
  }) => ({
    id: where.id,
    studentId: students[0].id,
    schoolYearId,
    ...data,
    student: students[0],
    section: { id: sectionId, name: section.name, gradeLevel: section.gradeLevel },
    schoolYear: { id: schoolYearId, name: "2025-2026" },
  }));
  transactionMocks.auditEntry.create.mockResolvedValue({});
}

describe("POST /api/enrollments/bulk", () => {
  afterEach(() => vi.clearAllMocks());

  it("enrolls one student and audits the write in one transaction", async () => {
    configureBulkMocks([makeStudent(studentIds[0])]);

    const response = await request(createApp())
      .post("/api/enrollments/bulk")
      .send({ sectionId, studentIds: [studentIds[0]] });

    expect(response.status).toBe(200);
    expect(response.body.enrolled).toHaveLength(1);
    expect(response.body.enrolled[0].studentId).toBe(studentIds[0]);
    expect(response.body.skipped).toEqual([]);
    expect(prismaMocks.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionMocks.auditEntry.create).toHaveBeenCalledTimes(1);
  });

  it("enrolls several students atomically", async () => {
    configureBulkMocks(studentIds.map(makeStudent));

    const response = await request(createApp())
      .post("/api/enrollments/bulk")
      .send({ sectionId, studentIds });

    expect(response.status).toBe(200);
    expect(response.body.enrolled).toHaveLength(3);
    expect(prismaMocks.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionMocks.enrollment.create).toHaveBeenCalledTimes(3);
    expect(transactionMocks.auditEntry.create).toHaveBeenCalledTimes(3);
  });

  it("returns 409 without writing when a student is already enrolled", async () => {
    configureBulkMocks([makeStudent(studentIds[0])], {
      existing: [{ id: "existing-enrollment", studentId: studentIds[0], status: "ENROLLED" }],
    });

    const response = await request(createApp())
      .post("/api/enrollments/bulk")
      .send({ sectionId, studentIds: [studentIds[0]] });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("ALREADY_ENROLLED");
    expect(transactionMocks.enrollment.create).not.toHaveBeenCalled();
  });

  it("returns 409 without writing when the section lacks capacity for the batch", async () => {
    configureBulkMocks([makeStudent(studentIds[0])], { capacity: 1, enrolledCount: 1 });

    const response = await request(createApp())
      .post("/api/enrollments/bulk")
      .send({ sectionId, studentIds: [studentIds[0]] });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("SECTION_FULL");
    expect(transactionMocks.enrollment.create).not.toHaveBeenCalled();
  });

  it("rejects malformed section and student IDs with 400", async () => {
    const invalidSection = await request(createApp())
      .post("/api/enrollments/bulk")
      .send({ sectionId: "bad", studentIds: [studentIds[0]] });
    const invalidStudent = await request(createApp())
      .post("/api/enrollments/bulk")
      .send({ sectionId, studentIds: ["bad"] });

    expect(invalidSection.status).toBe(400);
    expect(invalidStudent.status).toBe(400);
    expect(prismaMocks.section.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the section or a selected student no longer exists", async () => {
    configureBulkMocks([makeStudent(studentIds[0])]);
    transactionMocks.section.findUnique.mockResolvedValueOnce(null);
    const missingSection = await request(createApp())
      .post("/api/enrollments/bulk")
      .send({ sectionId, studentIds: [studentIds[0]] });

    expect(missingSection.status).toBe(404);
    configureBulkMocks([]);
    const missingStudent = await request(createApp())
      .post("/api/enrollments/bulk")
      .send({ sectionId, studentIds: [studentIds[0]] });

    expect(missingStudent.status).toBe(404);
    expect(transactionMocks.enrollment.create).not.toHaveBeenCalled();
  });

  it("rejects an empty or duplicate student selection with 400", async () => {
    const emptySelection = await request(createApp())
      .post("/api/enrollments/bulk")
      .send({ sectionId, studentIds: [] });
    const duplicateSelection = await request(createApp())
      .post("/api/enrollments/bulk")
      .send({ sectionId, studentIds: [studentIds[0], studentIds[0]] });

    expect(emptySelection.status).toBe(400);
    expect(duplicateSelection.status).toBe(400);
    expect(prismaMocks.$transaction).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated and non-Admin requests", async () => {
    const unauthenticated = await request(createApp())
      .post("/api/enrollments/bulk")
      .set("x-test-auth", "missing")
      .send({ sectionId, studentIds: [studentIds[0]] });
    const nonAdmin = await request(createApp())
      .post("/api/enrollments/bulk")
      .set("x-test-role", "TEACHER")
      .send({ sectionId, studentIds: [studentIds[0]] });

    expect(unauthenticated.status).toBe(401);
    expect(nonAdmin.status).toBe(403);
    expect(prismaMocks.$transaction).not.toHaveBeenCalled();
  });
});

describe("GET /api/enrollments", () => {
  afterEach(() => vi.clearAllMocks());

  it("writes deduplicated view audits in a batch within the listing transaction", async () => {
    prismaMocks.schoolYear.findUnique.mockResolvedValue({ id: schoolYearId });
    prismaMocks.enrollment.findMany.mockResolvedValue([
      { id: "enrollment-1", student: { id: studentIds[0] } },
      { id: "enrollment-2", student: { id: studentIds[1] } },
    ]);
    prismaMocks.enrollment.count.mockResolvedValue(2);
    prismaMocks.$transaction.mockImplementation(async (operation) => (
      Array.isArray(operation) ? Promise.all(operation) : operation(transactionMocks)
    ));
    transactionMocks.$queryRaw.mockResolvedValue([]);
    transactionMocks.auditEntry.findMany.mockResolvedValue([{ studentId: studentIds[1] }]);
    transactionMocks.auditEntry.createMany.mockResolvedValue({ count: 1 });

    const response = await request(createApp())
      .get(`/api/enrollments?schoolYearId=${schoolYearId}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(prismaMocks.$transaction).toHaveBeenCalledTimes(2);
    expect(transactionMocks.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transactionMocks.$queryRaw.mock.calls[0][0].join("?")).toContain("::text AS locked");
    expect(transactionMocks.auditEntry.findMany).toHaveBeenCalledTimes(1);
    expect(transactionMocks.auditEntry.createMany).toHaveBeenCalledWith({
      data: [{
        actorUserId: "test-admin",
        actorRole: "ADMIN",
        action: "VIEW_ENROLLMENTS",
        entityType: "Enrollment",
        entityId: "enrollment-1",
        studentId: studentIds[0],
        ip: "127.0.0.1",
      }],
    });
    expect(transactionMocks.auditEntry.create).not.toHaveBeenCalled();
  });
});
