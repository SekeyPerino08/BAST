import type { Role } from "@prisma/client";
import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import {
  advanceApplicant,
  createApplicant,
  enrollApplicant,
  listApplicants,
  updateApplicantDocuments,
} from "./admission.service.js";

function actorRequest(req: { user?: { id: string; role: Role; email: string }; ip?: string }) {
  if (!req.user) throw new AppError("Not authenticated", 401);
  return { user: req.user, ip: req.ip };
}

export const listApplicantsController = asyncHandler(async (req, res) => {
  res.status(200).json(await listApplicants(req.query));
});

export const createApplicantController = asyncHandler(async (req, res) => {
  res.status(201).json({ data: await createApplicant(req.body, actorRequest(req)) });
});

export const updateApplicantDocumentsController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json({ data: await updateApplicantDocuments(req.params.id, req.body, actorRequest(req)) });
});

export const advanceApplicantController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json({ data: await advanceApplicant(req.params.id, req.body, actorRequest(req)) });
});

export const enrollApplicantController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(201).json({ data: await enrollApplicant(req.params.id, req.body, actorRequest(req)) });
});
