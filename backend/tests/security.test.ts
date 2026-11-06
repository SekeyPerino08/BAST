import { createServer, type Server } from "node:http";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { EnrollmentStatus, Role, Sex } from "@prisma/client";
import request from "supertest";
import { loginSchema, passwordResetCompleteSchema, passwordResetRequestSchema } from "../src/schemas/auth.schema.js";
import { createAdminUserSchema } from "../src/modules/users/user.schema.js";
import { createStudentSchema, updateStatusSchema } from "../src/modules/students/student.schema.js";
import { saveGradesSchema } from "../src/modules/grades/grades.schema.js";
import {
  alumniRecordSchema,
  libraryLoanSchema,
  lmsEventSchema,
} from "../src/modules/integrations/integration.schema.js";
import { passwordPolicyError } from "../src/utils/password-policy.js";

describe("security and data quality rules", () => {
  it("normalizes names and email and strips unknown input", () => {
    const parsed = createStudentSchema.parse({
      studentNo: " stu-123 ",
      firstName: "  jAnE   marie ",
      lastName: " DOE ",
      sex: Sex.FEMALE,
      birthDate: "2008-01-01",
      unexpected: "removed",
    });

    expect(parsed.firstName).toBe("Jane Marie");
    expect(parsed.lastName).toBe("Doe");
    expect(parsed).not.toHaveProperty("unexpected");
    expect(loginSchema.parse({ identifier: "  USER@Example.COM ", password: "x" }).identifier)
      .toBe("user@example.com");
    expect(loginSchema.parse({ identifier: " stu-123 ", password: "x" }).identifier)
      .toBe("STU-123");
    expect(createAdminUserSchema.parse({
      email: " ADMIN@SCHOOL.EDU ",
      adminId: " admin-001 ",
    })).toMatchObject({ email: "admin@school.edu", adminId: "ADMIN-001" });
    expect(createAdminUserSchema.safeParse({
      email: "admin@school.edu",
      adminId: "admin@school.edu",
    }).success).toBe(false);
  });

  it("validates grade ranges, precision, feed values, and enrollment states", () => {
    expect(saveGradesSchema.safeParse({
      termId: "term-test-001",
      records: [{ studentId: "student-test-001", score: 85.25 }],
    }).success).toBe(true);
    expect(saveGradesSchema.safeParse({
      termId: "term-test-001",
      records: [{ studentId: "student-test-001", score: 100.005 }],
    }).success).toBe(false);
    expect(saveGradesSchema.safeParse({
      termId: "term-test-001",
      records: [{ studentId: "student-test-001", score: -1 }],
    }).success).toBe(false);
    expect(lmsEventSchema.safeParse({
      studentNo: "STU-1", externalId: "e1", type: "Quiz",
      occurredAt: "2026-01-01T12:00:00Z", score: -1,
    }).success).toBe(false);
    expect(libraryLoanSchema.safeParse({
      studentNo: "STU-1", externalId: "l1", bookTitle: "Book",
      loanedOn: "2026-02-02", dueOn: "2026-02-01",
    }).success).toBe(false);
    expect(alumniRecordSchema.safeParse({
      studentNo: "STU-1", externalId: "a1", kind: "Donation",
      amount: -1, occurredOn: "2026-01-01",
    }).success).toBe(false);
    expect(passwordResetRequestSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(passwordResetCompleteSchema.safeParse({ token: "short", newPassword: "GoodPass123" }).success).toBe(false);
    expect(updateStatusSchema.safeParse({ status: "ACTIVE" }).success).toBe(true);
    expect(updateStatusSchema.safeParse({ status: "UNKNOWN" }).success).toBe(false);
  });

  it("rejects weak passwords", () => {
    expect(passwordPolicyError("password1", "", "user@example.test")).not.toBeNull();
    expect(passwordPolicyError("user12345", "", "user@example.test")).not.toBeNull();
    expect(passwordPolicyError("SaferValue123", "", "user@example.test")).toBeNull();
  });
});

const integrationDatabaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL;
const integrationDescribe = integrationDatabaseUrl ? describe : describe.skip;

integrationDescribe("API authorization and integration coverage", () => {
  let app: import("express").Express;
  let prisma: (typeof import("../src/lib/prisma.js"))["prisma"];
  let webhook: Server;
  let webhookUrl = "";
  let resetDeliveries: Array<{ to: string; resetUrl: string }> = [];
  let testResetUserId: string | undefined;
  let sessionCookies = new Map<string, string>();
  let seededStudents: { benId: string; irisId: string; otherId: string };

  beforeAll(async () => {
    process.env.DATABASE_URL = integrationDatabaseUrl!;
    process.env.DIRECT_URL = integrationDatabaseUrl!;
    process.env.NODE_ENV = "test";
    process.env.CORS_ORIGIN = "http://localhost:3000";
    process.env.JWT_SECRET = "test-only-jwt-secret-with-at-least-sixty-four-characters";
    process.env.PASSWORD_RESET_DELIVERY_SECRET = "test-only-reset-delivery-secret-with-32-characters";

    webhook = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        if (request.headers.authorization !== `Bearer ${process.env.PASSWORD_RESET_DELIVERY_SECRET}`) {
          response.writeHead(403).end();
          return;
        }
        resetDeliveries.push(JSON.parse(Buffer.concat(chunks).toString()) as { to: string; resetUrl: string });
        response.writeHead(202).end();
      });
    });
    await new Promise<void>((resolve) => webhook.listen(0, "127.0.0.1", resolve));
    const address = webhook.address();
    if (!address || typeof address === "string") throw new Error("Reset test webhook did not bind a TCP port");
    webhookUrl = `http://127.0.0.1:${address.port}/deliver`;
    process.env.PASSWORD_RESET_DELIVERY_URL = webhookUrl;

    const [{ default: loadedApp }, db] = await Promise.all([
      import("../src/app.js"),
      import("../src/lib/prisma.js"),
    ]);
    app = loadedApp;
    prisma = db.prisma;
    const credentials = [
      ["ADMIN-0001", "admin"],
      ["TCH-0002", "teacher"],
      ["STU-2025-0002", "student"],
      ["iris.co@uni.edu", "alumni"],
    ] as const;
    for (const [identifier, key] of credentials) {
      const response = await request(app)
        .post("/api/auth/login")
        .set("Origin", "http://localhost:3000")
        .send({ identifier, password: "password123" });
      expect(response.status, `login ${identifier}`).toBe(200);
      sessionCookies.set(key, response.headers["set-cookie"][0].split(";")[0]);
    }

    const [ben, iris, other] = await Promise.all([
      prisma.student.findFirstOrThrow({ where: { user: { is: { email: "ben.ocampo@uni.edu" } } }, select: { id: true } }),
      prisma.student.findFirstOrThrow({ where: { user: { is: { email: "iris.co@uni.edu" } } }, select: { id: true } }),
      prisma.student.findUniqueOrThrow({ where: { studentNo: "STU-2025-0003" }, select: { id: true } }),
    ]);
    seededStudents = { benId: ben.id, irisId: iris.id, otherId: other.id };

    testResetUserId = `security-reset-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: testResetUserId,
        email: `${testResetUserId}@example.test`,
        passwordHash: await bcrypt.hash("BeforeReset123", 4),
        role: Role.STUDENT,
        firstName: "Security",
        lastName: "Test",
      },
    });
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      if (testResetUserId) {
        await prisma.passwordResetToken.deleteMany({ where: { userId: testResetUserId } });
        await prisma.user.deleteMany({ where: { id: testResetUserId } });
      }
      await prisma.$disconnect();
    }
    if (webhook) await new Promise<void>((resolve, reject) => webhook.close((error) => error ? reject(error) : resolve()));
  });

  it("enforces role access and prevents student ID substitution", async () => {
    const read = async (role: string, path: string) => request(app).get(path).set("Cookie", sessionCookies.get(role)!);
    const roleMatrix = [
      { path: "/api/users", allowed: ["admin"] },
      { path: "/api/teachers", allowed: ["admin"] },
      { path: "/api/imports", allowed: ["admin"] },
      { path: "/api/audit", allowed: ["admin"] },
      { path: "/api/sync/runs", allowed: ["admin"] },
      { path: "/api/reports", allowed: ["admin", "teacher"] },
      { path: "/api/school-years", allowed: ["admin", "teacher"] },
      { path: "/api/sections", allowed: ["admin", "teacher"] },
      { path: "/api/enrollments", allowed: ["admin"] },
      { path: "/api/class-offerings", allowed: ["admin"] },
      { path: "/api/dashboard/admin", allowed: ["admin"] },
      { path: "/api/dashboard/teacher", allowed: ["teacher"] },
      { path: "/api/dashboard/student", allowed: ["student"] },
      { path: "/api/me/profile", allowed: ["admin", "teacher", "student", "alumni"] },
      { path: "/api/me/enrollment", allowed: ["student"] },
      { path: "/api/me/attendance", allowed: ["student"] },
      { path: "/api/me/grades", allowed: ["student"] },
      { path: "/api/me/lms", allowed: ["student", "alumni"] },
      { path: "/api/me/library", allowed: ["student", "alumni"] },
      { path: "/api/me/alumni", allowed: ["alumni"] },
    ];
    for (const { path, allowed } of roleMatrix) {
      for (const role of ["admin", "teacher", "student", "alumni"]) {
        const response = await read(role, path);
        if (allowed.includes(role)) expect(response.status, `${role} ${path}`).toBe(200);
        else expect(response.status, `${role} ${path}`).toBe(403);
      }
    }

    expect((await read("admin", "/api/students")).status).toBe(200);
    for (const role of ["teacher", "student", "alumni"]) {
      expect((await read(role, "/api/students")).status).toBe(403);
      expect((await read(role, "/api/audit")).status).toBe(403);
      expect((await read(role, "/api/sync/runs")).status).toBe(403);
      expect((await read(role, "/api/enrollments")).status).toBe(403);
    }
    expect((await read("admin", "/api/audit")).status).toBe(200);
    expect((await read("admin", "/api/sync/runs")).status).toBe(200);
    expect((await read("admin", "/api/enrollments")).status).toBe(200);
    for (const role of ["admin", "teacher", "student", "alumni"]) {
      expect((await read(role, "/api/subjects")).status).toBe(200);
    }
    expect((await read("student", `/api/students/${seededStudents.benId}/lms`)).status).toBe(200);
    expect((await read("student", `/api/students/${seededStudents.otherId}/lms`)).status).toBe(404);
    expect((await read("student", `/api/students/${seededStudents.benId}/report-card`)).status).toBe(200);
    expect((await read("student", `/api/students/${seededStudents.otherId}/report-card`)).status).toBe(403);
    expect((await read("alumni", `/api/students/${seededStudents.irisId}/alumni`)).status).toBe(200);
    expect((await read("alumni", `/api/students/${seededStudents.benId}/alumni`)).status).toBe(404);

    const currentAdvisee = await prisma.student.findFirstOrThrow({
      where: {
        enrollments: {
          some: {
            status: EnrollmentStatus.ENROLLED,
            schoolYear: { is: { isCurrent: true } },
            section: { is: { adviser: { is: { userId: (await prisma.user.findUniqueOrThrow({ where: { email: "reyes@uni.edu" }, select: { id: true } })).id } } } },
          },
        },
      },
      select: { id: true },
    });
    expect((await read("teacher", `/api/students/${currentAdvisee.id}/lms`)).status).toBe(200);

    const duplicate = await request(app).post("/api/students")
      .set("Cookie", sessionCookies.get("admin")!)
      .set("Origin", "http://localhost:3000")
      .send({
        studentNo: "STU-2025-0003",
        firstName: "Duplicate",
        lastName: "Student",
        sex: "FEMALE",
        birthDate: "2008-01-01",
      });
    expect(duplicate.status).toBe(409);
  });

  it("limits teacher integration access to current advisees", async () => {
    const teacherUser = await prisma.user.findUniqueOrThrow({
      where: { email: "reyes@uni.edu" },
      select: { id: true, teacher: { select: { id: true } } },
    });
    const student = await prisma.student.findFirstOrThrow({
      where: {
        enrollments: {
          none: {
            status: EnrollmentStatus.ENROLLED,
            schoolYear: { is: { isCurrent: true } },
            section: { is: { adviserId: teacherUser.teacher!.id } },
          },
        },
      },
      select: { id: true },
    });
    const year = await prisma.schoolYear.create({
      data: {
        name: `security-history-${Date.now()}`,
        startDate: new Date("2020-01-01T00:00:00Z"),
        endDate: new Date("2020-12-31T00:00:00Z"),
        isCurrent: false,
      },
    });
    const section = await prisma.section.create({
      data: { name: "Former Advisees", gradeLevel: 7, schoolYearId: year.id, adviserId: teacherUser.teacher!.id },
    });
    await prisma.enrollment.create({
      data: { studentId: student.id, schoolYearId: year.id, sectionId: section.id },
    });
    try {
      const response = await request(app).get(`/api/students/${student.id}/lms`)
        .set("Cookie", sessionCookies.get("teacher")!);
      expect(response.status).toBe(404);
    } finally {
      await prisma.enrollment.deleteMany({ where: { schoolYearId: year.id } });
      await prisma.section.delete({ where: { id: section.id } });
      await prisma.schoolYear.delete({ where: { id: year.id } });
    }
  });

  it("requires a trusted origin for state-changing requests", async () => {
    expect((await request(app).post("/api/auth/login").send({ identifier: "ADMIN-0001", password: "password123" })).status).toBe(403);
    expect((await request(app).post("/api/auth/login")
      .set("Origin", "https://attacker.example")
      .send({ identifier: "ADMIN-0001", password: "password123" })).status).toBe(403);
  });

  it("does not create grade audit entries for rejected writes", async () => {
    const offering = await prisma.classOffering.findFirstOrThrow({
      select: { id: true, schoolYearId: true },
    });
    const term = await prisma.term.findFirstOrThrow({
      where: { schoolYearId: offering.schoolYearId },
      select: { id: true },
    });
    const before = await prisma.auditEntry.count({ where: { action: "GRADE_CHANGE" } });
    const response = await request(app).put(`/api/class-offerings/${offering.id}/grades`)
      .set("Cookie", sessionCookies.get("admin")!)
      .set("Origin", "http://localhost:3000")
      .send({ termId: term.id, records: [{ studentId: seededStudents.benId, score: 1000 }] });
    expect(response.status).toBe(400);
    expect(await prisma.auditEntry.count({ where: { action: "GRADE_CHANGE" } })).toBe(before);
  });

  it("sends generic reset responses and consumes valid reset tokens once", async () => {
    const testEmail = `${testResetUserId}@example.test`;
    const activeResponse = await request(app).post("/api/auth/password-reset/request")
      .set("Origin", "http://localhost:3000").send({ email: testEmail });
    const unknownResponse = await request(app).post("/api/auth/password-reset/request")
      .set("Origin", "http://localhost:3000").send({ email: "absent@example.test" });
    expect(activeResponse.status).toBe(202);
    expect(unknownResponse.status).toBe(202);
    expect(activeResponse.body.message).toBe(unknownResponse.body.message);
    const delivery = [...resetDeliveries].reverse().find(({ to }) => to === testEmail);
    expect(delivery).toBeDefined();
    const resetToken = new URLSearchParams(new URL(delivery!.resetUrl).hash.slice(1)).get("token");
    expect(resetToken).toBeTruthy();

    const complete = () => request(app).post("/api/auth/password-reset/complete")
      .set("Origin", "http://localhost:3000")
      .send({ token: resetToken, newPassword: "NewSecureValue123" });
    expect((await complete()).status).toBe(204);
    expect((await complete()).status).toBe(400);
    expect(await prisma.passwordResetToken.count({ where: { userId: testResetUserId, consumedAt: { not: null } } })).toBe(1);
  });
});
