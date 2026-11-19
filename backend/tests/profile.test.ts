import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { updateMyProfileSchema } from "../src/modules/me/me.schema.js";

const { serviceMocks } = vi.hoisted(() => ({
  serviceMocks: {
    getMyProfile: vi.fn(),
    getMyProfilePhoto: vi.fn(),
    updateMyProfile: vi.fn(),
    getMyClasses: vi.fn(),
    getMyAdvisoryStudents: vi.fn(),
    getMyEnrollment: vi.fn(),
    getMyAssignments: vi.fn(),
    getMyAnnouncements: vi.fn(),
    getMyDocumentRequests: vi.fn(),
    createMyDocumentRequest: vi.fn(),
    getMyLearningMaterials: vi.fn(),
    getMyNotifications: vi.fn(),
    getMySchedule: vi.fn(),
    getMyAcademicHistory: vi.fn(),
    markMyNotificationRead: vi.fn(),
  },
}));

vi.mock("../src/modules/me/me.service.js", () => serviceMocks);
vi.mock("../src/middleware/authenticate.js", () => ({
  authenticateAllowPending: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: "session-owner", email: "owner@example.test", role: "ADMIN" };
    next();
  },
  authenticate: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import meRouter from "../src/modules/me/me.routes.js";

const validProfile = {
  firstName: "  Ana  ",
  middleName: "",
  lastName: "Dela Cruz",
  phoneNumber: "+63 917-123-4567",
  dateOfBirth: "2000-01-15",
  sex: "FEMALE",
  address: "  Quezon City  ",
  removePhoto: "false",
};

function createTestApp() {
  const app = express();
  app.use("/api/me", meRouter);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error && typeof error === "object" && "statusCode" in error
      ? Number(error.statusCode)
      : 400;
    res.status(status).json({ message: error instanceof Error ? error.message : "Request failed" });
  });
  return app;
}

describe("personal profile validation", () => {
  it("trims and normalizes profile input", () => {
    expect(updateMyProfileSchema.parse(validProfile)).toMatchObject({
      firstName: "Ana",
      middleName: null,
      lastName: "Dela Cruz",
      phoneNumber: "+639171234567",
      address: "Quezon City",
      removePhoto: false,
    });
  });

  it("rejects invalid names, phone numbers, dates, and user identifiers", () => {
    expect(updateMyProfileSchema.safeParse({ ...validProfile, firstName: "A" }).success).toBe(false);
    expect(updateMyProfileSchema.safeParse({ ...validProfile, lastName: "Dela Cruz2" }).success).toBe(false);
    expect(updateMyProfileSchema.safeParse({ ...validProfile, phoneNumber: "555-0100" }).success).toBe(false);
    expect(updateMyProfileSchema.safeParse({ ...validProfile, dateOfBirth: "2999-01-01" }).success).toBe(false);
    expect(updateMyProfileSchema.safeParse({ ...validProfile, dateOfBirth: "2024-02-31" }).success).toBe(false);
    expect(updateMyProfileSchema.safeParse({ ...validProfile, userId: "another-user" }).success).toBe(false);
  });
});

describe("PATCH /api/me/profile", () => {
  afterEach(() => vi.clearAllMocks());

  it("uses the authenticated session user and returns saved details", async () => {
    serviceMocks.updateMyProfile.mockResolvedValueOnce({
      firstName: "Ana",
      middleName: null,
      lastName: "Dela Cruz",
      phoneNumber: "+639171234567",
      dateOfBirth: "2000-01-15",
      sex: "FEMALE",
      address: "Quezon City",
      hasPhoto: false,
      photoUpdatedAt: null,
    });

    const response = await request(createTestApp())
      .patch("/api/me/profile")
      .field(validProfile)
      .expect(200);

    expect(serviceMocks.updateMyProfile).toHaveBeenCalledWith(
      "session-owner",
      expect.objectContaining({ firstName: "Ana", phoneNumber: "+639171234567" }),
      undefined,
      expect.objectContaining({ user: expect.objectContaining({ id: "session-owner" }) }),
    );
    expect(response.body.firstName).toBe("Ana");
  });

  it("rejects attempts to choose another user account", async () => {
    await request(createTestApp())
      .patch("/api/me/profile")
      .field({ ...validProfile, userId: "someone-else" })
      .expect(400);

    expect(serviceMocks.updateMyProfile).not.toHaveBeenCalled();
  });
});
