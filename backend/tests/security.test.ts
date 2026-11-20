import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { EnrollmentStatus, Role, Sex } from "@prisma/client";
import request from "supertest";
import {
  loginSchema,
  passwordResetCompleteSchema,
  passwordResetRequestSchema,
  verifyPasswordResetCodeSchema,
} from "../src/schemas/auth.schema.js";
import { createAdminUserSchema } from "../src/modules/users/user.schema.js";
import { createStudentSchema, updateStatusSchema } from "../src/modules/students/student.schema.js";
import { saveGradesSchema } from "../src/modules/grades/grades.schema.js";
import {
  alumniRecordSchema,
  libraryLoanSchema,
  lmsEventSchema,
} from "../src/modules/integrations/integration.schema.js";
import { passwordPolicyError } from "../src/utils/password-policy.js";
import { seniorHighStrands } from "../src/constants/education.js";
import { enrollmentPlanSchema } from "../src/modules/enrollments/enrollment-plan.schema.js";
import { createSectionSchema } from "../src/modules/sections/section.schema.js";

const { resendSendMock } = vi.hoisted(() => ({ resendSendMock: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSendMock };
  },
}));

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
    expect(passwordResetRequestSchema.safeParse({ email: "" }).success).toBe(false);
    expect(passwordResetRequestSchema.safeParse({ email: "x".repeat(255) }).success).toBe(false);
    expect(passwordResetRequestSchema.safeParse({ email: "<script>alert(1)</script>" }).success).toBe(false);
    expect(passwordResetRequestSchema.parse({ email: " User@Mail.com " }).email).toBe("user@mail.com");
    expect(verifyPasswordResetCodeSchema.safeParse({ email: "user@mail.com", code: "012345" }).success).toBe(true);
    expect(verifyPasswordResetCodeSchema.safeParse({ email: "user@mail.com", code: "12345" }).success).toBe(false);
    expect(verifyPasswordResetCodeSchema.safeParse({ email: "user@mail.com", code: "12<345" }).success).toBe(false);
    expect(passwordResetCompleteSchema.safeParse({
      newPassword: "short",
      confirmPassword: "short",
    }).success).toBe(false);
    expect(passwordResetCompleteSchema.safeParse({
      newPassword: "GoodPass123",
      confirmPassword: "DifferentPass123",
    }).success).toBe(false);
    expect(passwordResetCompleteSchema.safeParse({
      newPassword: "GoodPass123",
      confirmPassword: "GoodPass123",
    }).success).toBe(true);
    expect(updateStatusSchema.safeParse({ status: "ACTIVE" }).success).toBe(true);
    expect(updateStatusSchema.safeParse({ status: "UNKNOWN" }).success).toBe(false);
  });

  it("rejects weak passwords", () => {
    expect(passwordPolicyError("password1", "", "user@example.test")).not.toBeNull();
    expect(passwordPolicyError("user12345", "", "user@example.test")).not.toBeNull();
    expect(passwordPolicyError("SaferValue123", "", "user@example.test")).toBeNull();
  });

  it("validates the ten configurable Senior High offerings and section caps", () => {
    const targets = [11, 12].flatMap((gradeLevel) => seniorHighStrands.map((strand) => ({
      gradeLevel,
      strand,
      expectedNew: null,
      expectedReturning: null,
      plannedSections: null,
    })));
    const plan = {
      registrationOpensAt: "2027-01-01",
      registrationClosesAt: "2027-02-01",
      firstDayOfClasses: "2027-06-01",
      requirements: [{ category: "NEW", name: "Latest report card", required: true }],
      specialPolicies: {
        transfers: "",
        scholarships: "",
        support: "",
        international: "",
        lateApplicants: "",
      },
      targets,
    };
    expect(enrollmentPlanSchema.safeParse(plan).success).toBe(true);
    expect(enrollmentPlanSchema.safeParse({
      ...plan,
      registrationClosesAt: "2026-12-31",
    }).success).toBe(false);
    expect(enrollmentPlanSchema.safeParse({
      ...plan,
      targets: [...targets.slice(1), targets[1]],
    }).success).toBe(false);
    expect(createSectionSchema.safeParse({
      gradeLevel: 11,
      name: "STEM A",
      strand: "STEM",
      capacity: 40,
    }).success).toBe(true);
    expect(createSectionSchema.safeParse({
      gradeLevel: 11,
      name: "Missing strand",
      capacity: 40,
    }).success).toBe(false);
    expect(createSectionSchema.safeParse({
      gradeLevel: 11,
      name: "Invalid capacity",
      strand: "STEM",
      capacity: 0,
    }).success).toBe(false);
  });

  it("sends reset codes through Resend and surfaces provider failures", async () => {
    process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
    process.env.DIRECT_URL ||= "postgresql://test:test@localhost:5432/test";
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test-only-jwt-secret-with-at-least-sixty-four-characters";
    process.env.RESEND_API_KEY = "re_test_key_for_mock";
    process.env.MAIL_FROM = "password-reset@example.test";
    const { sendPasswordResetCode } = await import("../src/services/email.service.js");
    resendSendMock.mockReset();
    resendSendMock.mockResolvedValue({ data: { id: "mock-resend-message" }, error: null });

    await sendPasswordResetCode("user@example.test", "012345");
    expect(resendSendMock).toHaveBeenCalledWith(expect.objectContaining({
      from: "password-reset@example.test",
      to: "user@example.test",
      text: expect.stringContaining("012345"),
      html: expect.stringContaining("012345"),
    }));

    resendSendMock.mockResolvedValueOnce({ data: null, error: { message: "provider unavailable" } });
    await expect(sendPasswordResetCode("user@example.test", "123456")).rejects.toThrow("provider unavailable");
  });
});

const integrationDatabaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL;
const integrationDescribe = integrationDatabaseUrl ? describe : describe.skip;

integrationDescribe("API authorization and integration coverage", () => {
  let app: import("express").Express;
  let prisma: (typeof import("../src/lib/prisma.js"))["prisma"];
  let resetDeliveries: Array<{ to: string; text: string; html: string }> = [];
  let testResetUserId: string | undefined;
  let otherResetUserId: string | undefined;
  let sessionCookies = new Map<string, string>();
  let seededStudents: { benId: string; irisId: string; otherId: string };

  beforeAll(async () => {
    process.env.DATABASE_URL = integrationDatabaseUrl!;
    process.env.DIRECT_URL = integrationDatabaseUrl!;
    process.env.NODE_ENV = "test";
    process.env.CORS_ORIGIN = "http://localhost:3000";
    process.env.JWT_SECRET = "test-only-jwt-secret-with-at-least-sixty-four-characters";
    process.env.RESEND_API_KEY = "re_test_key_for_mock";
    process.env.MAIL_FROM = "password-reset@example.test";
    process.env.TRUST_PROXY = "0";
    resetDeliveries = [];
    resendSendMock.mockReset();
    resendSendMock.mockImplementation(async (input: unknown) => {
      if (!input || typeof input !== "object") throw new Error("Unexpected Resend email payload");
      const email = input as { to?: unknown; text?: unknown; html?: unknown };
      if (typeof email.to !== "string" || typeof email.text !== "string" || typeof email.html !== "string") {
        throw new Error("Unexpected Resend email payload");
      }
      resetDeliveries.push({ to: email.to, text: email.text, html: email.html });
      return { data: { id: "mock-resend-message" }, error: null };
    });

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
        .send({ identifier, password: "Password123!" });
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
    otherResetUserId = `${testResetUserId}-other`;
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
    await prisma.user.create({
      data: {
        id: otherResetUserId,
        email: `${otherResetUserId}@example.test`,
        passwordHash: await bcrypt.hash("OtherBeforeReset123", 4),
        role: Role.STUDENT,
        firstName: "Other",
        lastName: "SecurityTest",
      },
    });
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      if (testResetUserId) {
        await prisma.passwordResetToken.deleteMany({ where: { userId: testResetUserId } });
        await prisma.passwordResetSession.deleteMany({ where: { userId: testResetUserId } });
        await prisma.user.deleteMany({ where: { id: testResetUserId } });
      }
      if (otherResetUserId) await prisma.user.deleteMany({ where: { id: otherResetUserId } });
      await prisma.$disconnect();
    }
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
    expect((await request(app).post("/api/auth/login").send({ identifier: "ADMIN-0001", password: "Password123!" })).status).toBe(403);
    expect((await request(app).post("/api/auth/login")
      .set("Origin", "https://attacker.example")
      .send({ identifier: "ADMIN-0001", password: "Password123!" })).status).toBe(403);
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

  it("verifies reset codes, enforces reset sessions, and invalidates prior logins", async () => {
    const testEmail = `${testResetUserId}@example.test`;
    const origin = "http://localhost:3000";
    const activeResponse = await request(app).post("/api/auth/password-reset/request")
      .set("Origin", origin).send({ email: ` ${testEmail.toUpperCase()} ` });
    const unknownResponse = await request(app).post("/api/auth/password-reset/request")
      .set("Origin", origin).send({ email: "absent@example.test" });
    expect(activeResponse.status).toBe(202);
    expect(unknownResponse.status).toBe(202);
    expect(activeResponse.body.message).toBe(unknownResponse.body.message);
    expect(resetDeliveries).toHaveLength(1);
    const delivery = resetDeliveries[0];
    expect(delivery).toBeDefined();
    expect(delivery.to).toBe(testEmail);
    const code = delivery.text.match(/\b(\d{6})\b/)?.[1];
    expect(code).toMatch(/^\d{6}$/);
    const challenge = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: testResetUserId, consumedAt: null },
    });
    expect(challenge.tokenHash).not.toContain(code);
    expect(challenge.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(challenge.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 10 * 60 * 1000);

    const login = await request(app).post("/api/auth/login")
      .set("Origin", origin).send({ identifier: testEmail, password: "BeforeReset123" });
    expect(login.status).toBe(200);
    const oldAuthCookie = login.headers["set-cookie"][0].split(";")[0];
    expect((await request(app).get("/api/auth/password-reset/session")).status).toBe(401);

    const verify = (email: string, value: string) => request(app).post("/api/auth/password-reset/verify")
      .set("Origin", origin).send({ email, code: value });
    expect((await verify(testEmail, "999999")).status).toBe(400);
    await prisma.passwordResetToken.update({
      where: { id: challenge.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect((await verify(testEmail.toUpperCase(), code!)).status).toBe(400);

    const renewed = await request(app).post("/api/auth/password-reset/request")
      .set("Origin", origin).send({ email: testEmail });
    expect(renewed.status).toBe(202);
    const renewedCode = resetDeliveries[resetDeliveries.length - 1].text.match(/\b(\d{6})\b/)?.[1];
    expect(renewedCode).toMatch(/^\d{6}$/);
    const verified = await verify(testEmail.toUpperCase(), renewedCode!);
    expect(verified.status).toBe(200);
    const setCookies = Array.isArray(verified.headers["set-cookie"])
      ? verified.headers["set-cookie"]
      : [verified.headers["set-cookie"]];
    const resetCookie = setCookies.find((value) => value.startsWith("password_reset_session="))?.split(";")[0];
    expect(resetCookie).toBeDefined();
    expect(setCookies.find((value) => value.startsWith("password_reset_session="))).toMatch(/HttpOnly/i);
    expect(resetCookie).not.toContain(testResetUserId);
    expect((await request(app).get("/api/auth/password-reset/session").set("Cookie", resetCookie)).status).toBe(200);

    const resetSession = await prisma.passwordResetSession.findFirstOrThrow({ where: { userId: testResetUserId } });
    await prisma.passwordResetSession.update({
      where: { id: resetSession.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect((await request(app).get("/api/auth/password-reset/session").set("Cookie", resetCookie)).status).toBe(401);
    await prisma.passwordResetSession.update({
      where: { id: resetSession.id },
      data: { expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });

    const complete = (newPassword: string, confirmPassword: string) => request(app)
      .post("/api/auth/password-reset/complete")
      .set("Origin", origin)
      .set("Cookie", resetCookie!)
      .send({ newPassword, confirmPassword, userId: otherResetUserId });
    expect((await complete("short", "short")).status).toBe(400);
    expect((await complete("FreshSecureValue123!", "DifferentSecureValue123!")).status).toBe(400);

    const candidates = ["FreshSecureValue123!", "AnotherSecureValue456!"];
    const completions = await Promise.all(candidates.map((password) => complete(password, password)));
    const successIndex = completions.findIndex((response) => response.status === 204);
    expect(successIndex).toBeGreaterThanOrEqual(0);
    expect(completions.filter((response) => response.status === 401)).toHaveLength(1);
    expect(completions[successIndex].headers["set-cookie"]).toEqual(expect.arrayContaining([
      expect.stringMatching(/school_token=;/),
      expect.stringMatching(/password_reset_session=;/),
    ]));
    expect((await request(app).get("/api/auth/me").set("Cookie", oldAuthCookie)).status).toBe(401);
    expect((await request(app).get("/api/auth/password-reset/session").set("Cookie", resetCookie)).status).toBe(401);

    const oldPasswordLogin = await request(app).post("/api/auth/login")
      .set("Origin", origin).send({ identifier: testEmail, password: "BeforeReset123" });
    const newPasswordLogin = await request(app).post("/api/auth/login")
      .set("Origin", origin).send({ identifier: testEmail, password: candidates[successIndex] });
    expect(oldPasswordLogin.status).toBe(401);
    expect(newPasswordLogin.status).toBe(200);
    const otherUser = await prisma.user.findUniqueOrThrow({
      where: { id: otherResetUserId },
      select: { passwordHash: true },
    });
    expect(await bcrypt.compare("OtherBeforeReset123", otherUser.passwordHash)).toBe(true);

    for (const email of ["rate-limit-one@example.test", "rate-limit-two@example.test"]) {
      expect((await request(app).post("/api/auth/password-reset/request")
        .set("Origin", origin).send({ email })).status).toBe(202);
    }
    const rateLimited = await request(app).post("/api/auth/password-reset/request")
      .set("Origin", origin).send({ email: "rate-limit-three@example.test" });
    expect(rateLimited.status).toBe(429);
  });
});
