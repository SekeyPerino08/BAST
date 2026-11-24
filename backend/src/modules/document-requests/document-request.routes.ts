import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { validateIdParams } from "../../middleware/validateIdParams.js";
import {
  listDocumentRequestsController,
  updateDocumentRequestController,
} from "./document-request.controller.js";
import { updateDocumentRequestSchema } from "./document-request.schema.js";

const router = Router();
router.param("id", validateIdParams("id"));
router.use(authenticate, authorize(Role.ADMIN));
router.get("/", listDocumentRequestsController);
router.patch("/:id", validateBody(updateDocumentRequestSchema), updateDocumentRequestController);

export default router;
