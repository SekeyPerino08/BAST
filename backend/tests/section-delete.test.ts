import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMocks, auditMock } = vi.hoisted(() => ({
  prismaMocks: {
    $transaction: vi.fn(),
  },
  auditMock: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMocks }));
vi.mock("../src/services/audit.service.js", () => ({ logAudit: auditMock }));

import { deleteSection } from "../src/modules/sections/section.service.js";

const section = { id: "section-test-1", name: "STEM A", gradeLevel: 11 };
const transactionMock = {
  section: {
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  enrollment: { count: vi.fn() },
  classOffering: { count: vi.fn() },
  classSchedule: { count: vi.fn() },
};

describe("deleteSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.section.findUnique.mockResolvedValue(section);
    transactionMock.section.delete.mockResolvedValue(section);
    transactionMock.enrollment.count.mockResolvedValue(0);
    transactionMock.classOffering.count.mockResolvedValue(0);
    transactionMock.classSchedule.count.mockResolvedValue(0);
    auditMock.mockResolvedValue(undefined);
    prismaMocks.$transaction.mockImplementation((callback) => callback(transactionMock));
  });

  afterEach(() => vi.clearAllMocks());

  it("blocks deletion when schedules still reference the section", async () => {
    transactionMock.classSchedule.count.mockResolvedValue(1);

    await expect(deleteSection(section.id)).rejects.toMatchObject({
      code: "SECTION_IN_USE",
      details: { enrollmentCount: 0, classOfferingCount: 0, scheduleCount: 1 },
    });

    expect(transactionMock.section.delete).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("deletes an unused section and records the action", async () => {
    await expect(deleteSection(section.id)).resolves.toBeUndefined();

    expect(transactionMock.section.delete).toHaveBeenCalledWith({ where: { id: section.id } });
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "DELETE",
      entity: "Section",
      entityId: section.id,
    }));
  });
});
