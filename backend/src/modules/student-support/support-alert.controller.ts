import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import {
  listStudentSupportAlerts,
  refreshStudentSupportAlerts,
  updateStudentSupportAlert,
} from "./support-alert.service.js";

export const listSupportAlertsController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await listStudentSupportAlerts(req.user));
});

export const refreshSupportAlertsController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await refreshStudentSupportAlerts(req.user));
});

export const updateSupportAlertController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json({
    data: await updateStudentSupportAlert(req.params.id, req.body, req.user, req),
  });
});
