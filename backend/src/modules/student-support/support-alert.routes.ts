import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";
import { validateIdParams } from "../../middleware/validateIdParams.js";
import {
  listSupportAlertsController,
  refreshSupportAlertsController,
  updateSupportAlertController,
} from "./support-alert.controller.js";
import { updateSupportAlertSchema } from "./support-alert.schema.js";

const router = Router();
router.param("id", validateIdParams("id"));
router.use(authenticate);
router.get("/", listSupportAlertsController);
router.post("/refresh", refreshSupportAlertsController);
router.patch("/:id", validateBody(updateSupportAlertSchema), updateSupportAlertController);

export default router;
