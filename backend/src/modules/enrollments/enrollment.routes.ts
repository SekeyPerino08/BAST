import { Role } from "@prisma/client";
import { Router } from "express";
import { validateIdParams } from "../../middleware/validateIdParams.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import {
  getEnrollmentPlanCapacityController,
  getEnrollmentPlanController,
  saveEnrollmentPlanController,
} from "./enrollment-plan.controller.js";
import { enrollmentPlanSchema } from "./enrollment-plan.schema.js";
import {
  bulkEnrollController,
  createEnrollmentController,
  listEnrollmentsController,
  listUnassignedStudentsController,
  transferEnrollmentController,
  updateEnrollmentStatusController,
} from "./enrollment.controller.js";
import {
  bulkEnrollSchema,
  createEnrollmentSchema,
  transferEnrollmentSchema,
  updateEnrollmentStatusSchema,
} from "./enrollment.schema.js";

const router = Router();
router.param("id", validateIdParams("id"));
router.param("schoolYearId", validateIdParams("schoolYearId"));
router.use(authenticate, authorize(Role.ADMIN));
router.get("/capacity/:schoolYearId", getEnrollmentPlanCapacityController);
router.get("/settings/:schoolYearId", getEnrollmentPlanController);
router.put("/settings/:schoolYearId", validateBody(enrollmentPlanSchema), saveEnrollmentPlanController);
router.get("/", listEnrollmentsController);
router.get("/unassigned", listUnassignedStudentsController);
router.post("/", validateBody(createEnrollmentSchema), createEnrollmentController);
router.post("/bulk", validateBody(bulkEnrollSchema), bulkEnrollController);
router.patch("/:id/transfer", validateBody(transferEnrollmentSchema), transferEnrollmentController);
router.patch("/:id/status", validateBody(updateEnrollmentStatusSchema), updateEnrollmentStatusController);
// Enrollment rows are retained as academic history; status changes replace deletion.
export default router;
