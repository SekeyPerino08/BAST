import type { ParamsDictionary } from "express-serve-static-core";
import { AppError } from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { listDocumentRequests, updateDocumentRequest } from "./document-request.service.js";

export const listDocumentRequestsController = asyncHandler(async (_req, res) => {
  res.status(200).json(await listDocumentRequests());
});

export const updateDocumentRequestController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await updateDocumentRequest(
    req.params.id,
    req.body,
    req.user.id,
    req.ip,
  ));
});
