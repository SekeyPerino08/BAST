import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { validateIdParams } from "../../middleware/validateIdParams.js";
import {
  advanceApplicantController,
  createApplicantController,
  enrollApplicantController,
  listApplicantsController,
  updateApplicantDocumentsController,
} from "./admission.controller.js";
import {
  advanceApplicantSchema,
  createApplicantSchema,
  enrollApplicantSchema,
  updateApplicantDocumentsSchema,
} from "./admission.schema.js";

const router = Router();
router.param("id", validateIdParams("id"));
router.use(authenticate, authorize(Role.ADMIN));
router.get("/", listApplicantsController);
router.post("/", validateBody(createApplicantSchema), createApplicantController);
router.put("/:id/documents", validateBody(updateApplicantDocumentsSchema), updateApplicantDocumentsController);
router.patch("/:id/stage", validateBody(advanceApplicantSchema), advanceApplicantController);
router.post("/:id/enroll", validateBody(enrollApplicantSchema), enrollApplicantController);

export default router;
