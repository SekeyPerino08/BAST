import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import { getDataProtectionOverview, recordRecoveryExercise } from "./data-protection.service.js";

export const getDataProtectionOverviewController = asyncHandler(async (_req, res) => {
  res.status(200).json({ data: await getDataProtectionOverview() });
});

export const recordRecoveryExerciseController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(201).json({ data: await recordRecoveryExercise(req.body, req) });
});
