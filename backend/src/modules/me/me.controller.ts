import { AppError } from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createMyDocumentRequest,
  getMyAcademicHistory,
  getMyAnnouncements,
  getMyAssignments,
  getMyDocumentRequests,
  getMyAdvisoryStudents,
  getMyClasses,
  getMyEnrollment,
  getMyLearningMaterials,
  getMyNotifications,
  getMyProfile,
  getMySchedule,
  markMyNotificationRead,
} from "./me.service.js";

export const getMyProfileController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyProfile(req.user.id));
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

export const getMyAssignmentsController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyAssignments(req.user.id));
});

export const getMyAnnouncementsController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyAnnouncements(req.user.id));
});

export const getMyScheduleController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMySchedule(req.user.id));
});

export const getMyLearningMaterialsController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyLearningMaterials(req.user.id));
});

export const getMyDocumentRequestsController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyDocumentRequests(req.user.id));
});

export const createMyDocumentRequestController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(201).json(await createMyDocumentRequest(req.user.id, req.body));
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
