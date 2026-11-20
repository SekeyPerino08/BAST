import express from "express";
import type { Request, Response, NextFunction } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { getStudentLibrary, listLibraryLoans, exportLibraryLoans } from "../src/modules/integrations/integration.service.js";

const { prismaMocks, auditMock } = vi.hoisted(() => ({
  prismaMocks: {
    libraryLoan: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    teacher: { findUnique: vi.fn() },
    student: { findFirst: vi.fn() },
    section: { findMany: vi.fn() },
  },
  auditMock: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMocks }));
vi.mock("../src/audit.js", () => ({ audit: auditMock }));
vi.mock("../src/middleware/authenticate.js", () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const role = req.get("x-test-role") ?? "ADMIN";
    req.user = {
      id: "test-user",
      email: "test@example.test",
      role: role as "ADMIN" | "TEACHER" | "STUDENT" | "ALUMNI",
    };
    next();
  },
}));

import { errorHandler } from "../src/middleware/errorHandler.js";
import studentRouter from "../src/modules/students/student.routes.js";

const admin = { id: "admin-id", role: Role.ADMIN };

function createStudentApiApp() {
  const app = express();
  app.use("/api/students", studentRouter);
  app.use(errorHandler);
  return app;
}

function libraryLoan(
  id: string,
  dueOn: string,
  returnedOn: string | null,
  studentId = `student-${id}`,
) {
  return {
    id,
    bookTitle: `Book ${id}`,
    loanedOn: new Date("2026-11-01T00:00:00.000Z"),
    dueOn: new Date(`${dueOn}T00:00:00.000Z`),
    returnedOn: returnedOn ? new Date(`${returnedOn}T00:00:00.000Z`) : null,
    student: {
      id: studentId,
      studentNo: `STU-${id}`,
      firstName: "Ana",
      middleName: null,
      lastName: "Cruz",
      enrollments: [{
        section: {
          id: "section-own",
          name: "STEM 11-A",
          gradeLevel: 11,
          strand: "STEM",
          adviser: { firstName: "Alex", middleName: null, lastName: "Santos" },
        },
      }],
    },
  };
}

function configureMocks(rows: ReturnType<typeof libraryLoan>[] = []) {
  prismaMocks.libraryLoan.findMany.mockResolvedValue(rows);
  prismaMocks.libraryLoan.count.mockResolvedValue(0);
  prismaMocks.libraryLoan.groupBy.mockResolvedValue([]);
  prismaMocks.teacher.findUnique.mockResolvedValue({ id: "teacher-id" });
  prismaMocks.student.findFirst.mockResolvedValue(null);
  prismaMocks.section.findMany.mockResolvedValue([]);
}

describe("library overdue list", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T12:00:00.000Z"));
    configureMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("uses the Manila calendar date and excludes returned items from overdue days", async () => {
    configureMocks([
      libraryLoan("past-due", "2026-11-19", null),
      libraryLoan("due-today", "2026-11-20", null),
      libraryLoan("returned", "2026-11-18", "2026-11-19"),
    ]);

    const result = await listLibraryLoans({ status: "ALL" }, admin);

    expect(result.data.map(({ status, daysOverdue }) => ({ status, daysOverdue }))).toEqual([
      { status: "Overdue", daysOverdue: 1 },
      { status: "Borrowed", daysOverdue: 0 },
      { status: "Returned", daysOverdue: 0 },
    ]);
  });

  it("does not apply an adviser filter to Admin results", async () => {
    configureMocks([libraryLoan("admin-loan", "2026-11-19", null)]);

    await listLibraryLoans({ status: "OVERDUE" }, admin);

    const query = prismaMocks.libraryLoan.findMany.mock.calls[0][0];
    expect(JSON.stringify(query.where)).not.toContain("adviserId");
    expect(prismaMocks.teacher.findUnique).not.toHaveBeenCalled();
  });

  it("intersects an Adviser section filter with their own current advisory section", async () => {
    const app = createStudentApiApp();
    const response = await request(app)
      .get("/api/students/library-loans?status=OVERDUE&sectionId=another-section")
      .set("x-test-role", "TEACHER");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    const query = prismaMocks.libraryLoan.findMany.mock.calls[0][0];
    const where = JSON.stringify(query.where);
    expect(where).toContain('"adviserId":"teacher-id"');
    expect(where).toContain('"status":"ACTIVE"');
    expect(where).toContain('"id":"another-section"');
    expect(prismaMocks.section.findMany.mock.calls[0][0].where).toMatchObject({ adviserId: "teacher-id" });
  });

  it("does not expose transferred students through the adviser student-detail endpoint", async () => {
    await expect(getStudentLibrary("student-id", { id: "teacher-user-id", role: Role.TEACHER }))
      .rejects.toMatchObject({ statusCode: 404 });

    expect(prismaMocks.student.findFirst.mock.calls[0][0].where).toMatchObject({
      status: "ACTIVE",
      enrollments: {
        some: {
          status: "ENROLLED",
          schoolYear: { is: { isCurrent: true } },
          section: { is: { adviserId: "teacher-id" } },
        },
      },
    });
  });

  it("returns an empty result and zero pagination totals when no loans match", async () => {
    const result = await listLibraryLoans({ status: "OVERDUE" }, admin);

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(result.summary.overdueItems).toBe(0);
  });

  it.each(["STUDENT", "ALUMNI"])("returns 403 to a %s calling the all-student overdue API", async (role) => {
    const response = await request(createStudentApiApp())
      .get("/api/students/library-loans")
      .set("x-test-role", role);

    expect(response.status).toBe(403);
    expect(prismaMocks.libraryLoan.findMany).not.toHaveBeenCalled();
  });

  it("exports the scoped data and logs Admin CSV exports", async () => {
    configureMocks([libraryLoan("export", "2026-11-19", null)]);
    const requestContext = {
      user: { id: "admin-id", email: "admin@example.test", role: Role.ADMIN },
      ip: "127.0.0.1",
    };

    const csv = await exportLibraryLoans({ status: "OVERDUE" }, admin, requestContext);

    expect(csv).toContain("Student Name,Student ID,Grade Level,Strand,Section,Adviser,Book Title,Borrow Date,Due Date,Days Overdue");
    expect(csv).toContain("Ana Cruz,STU-export,11,STEM,STEM 11-A,Alex Santos,Book export,2026-11-01,2026-11-19,1");
    expect(auditMock).toHaveBeenCalledWith(
      expect.anything(),
      requestContext,
      expect.objectContaining({ action: "EXPORT_LIBRARY_OVERDUE", entityType: "LibraryLoan" }),
    );
  });
});
