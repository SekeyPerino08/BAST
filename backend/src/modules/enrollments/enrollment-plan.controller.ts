import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getEnrollmentPlan, getEnrollmentPlanCapacity, saveEnrollmentPlan } from "./enrollment-plan.service.js";
import type { EnrollmentPlanInput } from "./enrollment-plan.schema.js";

export const getEnrollmentPlanController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json({ data: await getEnrollmentPlan(req.params.schoolYearId) });
});

export const getEnrollmentPlanCapacityController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json(await getEnrollmentPlanCapacity(req.params.schoolYearId));
});

export const saveEnrollmentPlanController = asyncHandler<
  ParamsDictionary,
  unknown,
  EnrollmentPlanInput
>(async (req, res) => {
  res.status(200).json({ data: await saveEnrollmentPlan(req.params.schoolYearId, req.body, req) });
});
