import { DocumentRequestStatus, NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../services/audit.service.js";
import { AppError } from "../../utils/AppError.js";
import type { UpdateDocumentRequestInput } from "./document-request.schema.js";

const requestInclude = {
  student: {
    select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true },
  },
} satisfies Prisma.DocumentRequestInclude;

export async function listDocumentRequests() {
  const data = await prisma.documentRequest.findMany({
    orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
    include: requestInclude,
  });
  return { data };
}

export async function updateDocumentRequest(
  id: string,
  input: UpdateDocumentRequestInput,
  actorId: string,
  ipAddress?: string,
) {
  return prisma.$transaction(async (transaction) => {
    const before = await transaction.documentRequest.findUnique({
      where: { id },
      select: {
        id: true,
        documentType: true,
        status: true,
        adminRemarks: true,
        processedAt: true,
        student: { select: { id: true, userId: true } },
      },
    });
    if (!before) throw new AppError("Document request not found", 404, "DOCUMENT_REQUEST_NOT_FOUND");

    const allowedFrom: DocumentRequestStatus[] = input.status === DocumentRequestStatus.APPROVED
      ? [DocumentRequestStatus.PENDING, DocumentRequestStatus.PROCESSING]
      : input.status === DocumentRequestStatus.READY_FOR_PICKUP
        ? [DocumentRequestStatus.APPROVED]
        : [DocumentRequestStatus.PENDING, DocumentRequestStatus.PROCESSING, DocumentRequestStatus.APPROVED];
    if (!allowedFrom.includes(before.status)) {
      throw new AppError("This document request can no longer be updated from its current status", 409, "INVALID_DOCUMENT_REQUEST_TRANSITION");
    }

    const changed = await transaction.documentRequest.updateMany({
      where: { id, status: { in: allowedFrom } },
      data: {
        status: input.status,
        processedAt: before.processedAt ?? new Date(),
        ...(input.adminRemarks === undefined ? {} : { adminRemarks: input.adminRemarks }),
      },
    });
    if (!changed.count) {
      throw new AppError("The document request status changed. Refresh and try again.", 409, "DOCUMENT_REQUEST_STATUS_CHANGED");
    }
    const updated = await transaction.documentRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!updated) throw new AppError("Document request not found", 404, "DOCUMENT_REQUEST_NOT_FOUND");

    if (before.student.userId) {
      const statusText = input.status === DocumentRequestStatus.APPROVED
        ? "accepted"
        : input.status === DocumentRequestStatus.READY_FOR_PICKUP
          ? "ready for pickup"
          : "rejected";
      const title = input.status === DocumentRequestStatus.READY_FOR_PICKUP
        ? "Document ready for pickup"
        : `Document request ${statusText}`;
      await transaction.notification.create({
        data: {
          userId: before.student.userId,
          studentId: before.student.id,
          type: NotificationType.DOCUMENT,
          title,
          message: `Your ${before.documentType.toLowerCase().replaceAll("_", " ")} request is ${statusText}.${input.adminRemarks ? ` ${input.adminRemarks}` : ""}`,
          actionUrl: "/student/documents",
        },
      });
    }

    await logAudit({
      userId: actorId,
      action: "DOCUMENT_REQUEST_UPDATED",
      entity: "DocumentRequest",
      entityId: id,
      details: {
        before: { status: before.status, adminRemarks: before.adminRemarks },
        after: { status: updated.status, adminRemarks: updated.adminRemarks },
      },
      ipAddress,
    }, transaction);

    return { data: updated };
  });
}
