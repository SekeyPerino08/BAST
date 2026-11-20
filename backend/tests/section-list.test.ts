import express from "express";
import type { Request, Response, NextFunction } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../src/middleware/errorHandler.js";

const { prismaMocks } = vi.hoisted(() => ({
  prismaMocks: {
    $transaction: vi.fn(),
    section: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMocks }));
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

import sectionRouter from "../src/modules/sections/section.routes.js";

const schoolYearId = "cmvkz4exi0007f3pkscfyf67t";
const emptySchoolYearId = "school-year-empty";
const section = {
  id: "cmw4mip7j000nf3swdgn76uxt",
  name: "STEM 11-A",
  gradeLevel: 11,
  strand: "STEM",
  capacity: 40,
  schoolYearId,
  adviserId: null,
  schoolYear: { id: schoolYearId, name: "2025-2026", isCurrent: true },
  adviser: null,
  _count: { enrollments: 12, classOfferings: 0 },
};

function createApp() {
  const app = express();
  app.use("/api/sections", sectionRouter);
  app.use(errorHandler);
  return app;
}

describe("GET /api/sections", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns sections for the requested school year in grade/strand/name order", async () => {
    prismaMocks.$transaction.mockResolvedValueOnce([[section], 1]);

    const response = await request(createApp())
      .get(`/api/sections?schoolYearId=${schoolYearId}&page=1&pageSize=100`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject([{ id: section.id, schoolYearId, strand: "STEM" }]);
    expect(response.body.meta.total).toBe(1);
    expect(prismaMocks.section.findMany.mock.calls[0][0]).toMatchObject({
      where: { schoolYearId },
      orderBy: [{ gradeLevel: "asc" }, { strand: "asc" }, { name: "asc" }],
      take: 100,
    });
  });

  it("rejects a malformed schoolYearId with 400 before querying", async () => {
    const response = await request(createApp())
      .get("/api/sections?schoolYearId=bad-id&page=1&pageSize=100");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation failed");
    expect(prismaMocks.$transaction).not.toHaveBeenCalled();
  });

  it("returns an empty list for a year with no sections", async () => {
    prismaMocks.$transaction.mockResolvedValueOnce([[], 0]);

    const response = await request(createApp())
      .get(`/api/sections?schoolYearId=${emptySchoolYearId}&page=1&pageSize=100`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
    expect(prismaMocks.section.findMany.mock.calls[0][0].where).toMatchObject({
      schoolYearId: emptySchoolYearId,
    });
  });

  it("rejects non-admin roles before querying sections", async () => {
    const response = await request(createApp())
      .get(`/api/sections?schoolYearId=${schoolYearId}`)
      .set("x-test-role", "TEACHER");

    expect(response.status).toBe(403);
    expect(prismaMocks.section.findMany).not.toHaveBeenCalled();
  });
});
