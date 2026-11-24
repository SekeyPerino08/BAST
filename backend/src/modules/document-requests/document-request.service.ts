import { DocumentRequestStatus, Prisma } from "@prisma/client";
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
      select: { id: true, status: true, adminRemarks: true, processedAt: true },
    });
    if (!before) throw new AppError("Document request not found", 404, "DOCUMENT_REQUEST_NOT_FOUND");

    const updated = await transaction.documentRequest.update({
      where: { id },
      data: {
        ...(input.status === undefined ? {} : {
          status: input.status,
          processedAt: input.status === DocumentRequestStatus.PENDING
            ? null
            : before.processedAt ?? new Date(),
        }),
        ...(input.adminRemarks === undefined ? {} : { adminRemarks: input.adminRemarks }),
      },
      include: requestInclude,
    });

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
