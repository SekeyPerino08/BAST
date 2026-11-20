import express from "express";
import { Prisma } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getAdminDashboard } = vi.hoisted(() => ({ getAdminDashboard: vi.fn() }));

vi.mock("../src/modules/dashboard/dashboard.service.js", () => ({
  getAdminDashboard,
  getStudentDashboard: vi.fn(),
  getTeacherDashboard: vi.fn(),
}));

import { errorHandler } from "../src/middleware/errorHandler.js";
import { getAdminDashboardController } from "../src/modules/dashboard/dashboard.controller.js";

describe("admin dashboard controller", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns a clear error response for Prisma data-shape errors", async () => {
    getAdminDashboard.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError(
      "Inconsistent column data",
      {
        clientVersion: "6.19.3",
        code: "P2032",
        meta: { modelName: "Student", field: "userId", expected_type: "String", found: "null" },
      },
    ));

    const app = express();
    app.get("/", getAdminDashboardController);
    app.use(errorHandler);

    const response = await request(app).get("/");

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      message: "Dashboard data does not match the database schema. Review the backend error log and repair the affected records.",
      code: "DASHBOARD_DATA_INCONSISTENT",
    });
  });
});
