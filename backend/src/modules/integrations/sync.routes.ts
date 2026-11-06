import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateIdParams } from "../../middleware/validateIdParams.js";
import {
  getSyncRejectsController,
  listSyncRunsController,
  syncFeedController,
} from "./integration.controller.js";

const router = Router();
router.param("id", validateIdParams("id"));
router.use(authenticate, authorize(Role.ADMIN));
router.post("/:source", syncFeedController);
router.get("/runs", listSyncRunsController);
router.get("/runs/:id/rejects", getSyncRejectsController);
export default router;
