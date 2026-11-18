import { Prisma } from "@prisma/client";
import { AppError } from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getAdminDashboard, getStudentDashboard, getTeacherDashboard } from "./dashboard.service.js";

export const getAdminDashboardController = asyncHandler(async (req, res) => {
  try {
    res.status(200).json(await getAdminDashboard());
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2032") {
      throw new AppError(
        "Dashboard data does not match the database schema. Review the backend error log and repair the affected records.",
        500,
        "DASHBOARD_DATA_INCONSISTENT",
      );
    }
    throw error;
  }
});

export const getTeacherDashboardController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getTeacherDashboard(req.user.id));
});

export const getStudentDashboardController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getStudentDashboard(req.user.id));
});
