import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentRequestStatus, NotificationType } from "@prisma/client";

const { prismaMocks, auditMock } = vi.hoisted(() => ({
  prismaMocks: {
    $transaction: vi.fn(),
    student: { findUnique: vi.fn() },
  },
  auditMock: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMocks }));
vi.mock("../src/services/audit.service.js", () => ({ logAudit: auditMock }));

import { updateDocumentRequest } from "../src/modules/document-requests/document-request.service.js";
import { createMyDocumentRequest } from "../src/modules/me/me.service.js";

const transactionMocks = {
  documentRequest: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  user: { findMany: vi.fn() },
  notification: {
    create: vi.fn(),
    createMany: vi.fn(),
  },
};

describe("document request notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.$transaction.mockImplementation(async (operation) => operation(transactionMocks));
    prismaMocks.student.findUnique.mockResolvedValue({
      id: "student-1",
      studentNo: "STU-1",
      firstName: "Ana",
      middleName: null,
      lastName: "Reyes",
    });
    transactionMocks.user.findMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }]);
    transactionMocks.documentRequest.create.mockResolvedValue({
      id: "request-1",
      documentType: "CERTIFICATE_OF_ENROLLMENT",
    });
    transactionMocks.documentRequest.updateMany.mockResolvedValue({ count: 1 });
    transactionMocks.notification.createMany.mockResolvedValue({ count: 2 });
    transactionMocks.notification.create.mockResolvedValue({});
    auditMock.mockResolvedValue(undefined);
  });

  afterEach(() => vi.clearAllMocks());

  it("notifies active admins when a student submits a request", async () => {
    await createMyDocumentRequest("student-user", {
      documentType: "CERTIFICATE_OF_ENROLLMENT",
      reason: "Scholarship application",
    });

    expect(transactionMocks.user.findMany).toHaveBeenCalledWith({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    expect(transactionMocks.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "admin-1",
          type: NotificationType.DOCUMENT,
          title: "New document request",
          actionUrl: "/admin/document-requests",
        }),
        expect.objectContaining({
          userId: "admin-2",
          type: NotificationType.DOCUMENT,
          title: "New document request",
          actionUrl: "/admin/document-requests",
        }),
      ],
    });
  });

  it("notifies the student with the rejection reason", async () => {
    const processedAt = new Date();
    transactionMocks.documentRequest.findUnique
      .mockResolvedValueOnce({
        id: "request-1",
        documentType: "CERTIFICATE_OF_ENROLLMENT",
        status: DocumentRequestStatus.PENDING,
        adminRemarks: null,
        processedAt: null,
        student: { id: "student-1", userId: "student-user" },
      })
      .mockResolvedValueOnce({
        id: "request-1",
        status: DocumentRequestStatus.REJECTED,
        adminRemarks: "Missing signature",
        processedAt,
      });

    await updateDocumentRequest("request-1", {
      status: DocumentRequestStatus.REJECTED,
      adminRemarks: "Missing signature",
    }, "admin-user");

    expect(transactionMocks.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "student-user",
        studentId: "student-1",
        type: NotificationType.DOCUMENT,
        title: "Document request rejected",
        message: "Your certificate of enrollment request is rejected. Missing signature",
        actionUrl: "/student/documents",
      },
    });
  });
});
