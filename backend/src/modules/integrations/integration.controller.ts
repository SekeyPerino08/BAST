import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import {
  getStudentAlumni,
  getStudentLibrary,
  getStudentLms,
  getMyStudentAlumni,
  getMyStudentLibrary,
  getMyStudentLms,
  getSyncRejects,
  listSyncRuns,
  syncFeed,
} from "./integration.service.js";

export const syncFeedController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await syncFeed(req.params, req.query, req.user, req));
});

export const listSyncRunsController = asyncHandler(async (req, res) => {
  res.status(200).json(await listSyncRuns(req.query));
});

export const getSyncRejectsController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json({ data: await getSyncRejects(req.params.id) });
});

export const getStudentLmsController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getStudentLms(req.params.id, req.user));
});

export const getStudentLibraryController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json({ data: await getStudentLibrary(req.params.id, req.user) });
});

export const getStudentAlumniController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json({ data: await getStudentAlumni(req.params.id, req.user) });
});

export const getMyStudentLmsController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyStudentLms(req.user));
});

export const getMyStudentLibraryController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json({ data: await getMyStudentLibrary(req.user) });
});

export const getMyStudentAlumniController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json({ data: await getMyStudentAlumni(req.user) });
});
