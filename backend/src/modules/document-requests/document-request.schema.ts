import { DocumentRequestStatus, DocumentRequestType } from "@prisma/client";
import { z } from "zod";

export const createStudentDocumentRequestSchema = z.object({
  documentType: z.nativeEnum(DocumentRequestType),
  reason: z.string().trim().min(1).max(500),
  details: z.string().trim().max(2000).optional(),
});

export const updateDocumentRequestSchema = z.object({
  status: z.nativeEnum(DocumentRequestStatus).optional(),
  adminRemarks: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => value.status !== undefined || value.adminRemarks !== undefined, {
  message: "Provide a status or staff note to update",
});

export type CreateStudentDocumentRequestInput = z.infer<typeof createStudentDocumentRequestSchema>;
export type UpdateDocumentRequestInput = z.infer<typeof updateDocumentRequestSchema>;
