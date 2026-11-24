import type { ParamsDictionary } from "express-serve-static-core";
import { AppError } from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createMyDocumentRequest,
  getMyAcademicHistory,
  getMyAnnouncements,
  getMyDocumentRequests,
  getMyAdvisoryStudents,
  getMyClasses,
  getMyEnrollment,
  getMyNotifications,
  getMyProfile,
  getMyProfilePhoto,
  getMySchedule,
  markMyNotificationRead,
  updateMyProfile,
} from "./me.service.js";
import type { UpdateMyProfileInput } from "./me.schema.js";
import type { CreateStudentDocumentRequestInput } from "../document-requests/document-request.schema.js";

export const getMyProfileController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyProfile(req.user.id));
});

export const getMyProfilePhotoController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  const photo = await getMyProfilePhoto(req.user.id);
  res.set("Cache-Control", "private, no-store");
  res.type(photo.mime).status(200).send(photo.data);
});

export const updateMyProfileController = asyncHandler<ParamsDictionary, unknown, UpdateMyProfileInput>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await updateMyProfile(req.user.id, req.body, req.file, req));
});

export const getMyClassesController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyClasses(req.user.id, req.query));
});

export const getMyAdvisoryStudentsController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyAdvisoryStudents(req.user.id));
});

export const getMyEnrollmentController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyEnrollment(req.user.id));
});

export const getMyAnnouncementsController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyAnnouncements(req.user.id));
});

export const getMyScheduleController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMySchedule(req.user.id));
});

export const getMyDocumentRequestsController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyDocumentRequests(req.user.id));
});

export const createMyDocumentRequestController = asyncHandler<ParamsDictionary, unknown, CreateStudentDocumentRequestInput>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(201).json(await createMyDocumentRequest(req.user.id, req.body, req.ip));
});

export const getMyNotificationsController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyNotifications(req.user.id));
});

export const markMyNotificationReadController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await markMyNotificationRead(req.user.id, req.params.id));
});

export const getMyAcademicHistoryController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyAcademicHistory(req.user.id));
});
