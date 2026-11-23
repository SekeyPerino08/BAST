import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { getDataProtectionOverviewController, recordRecoveryExerciseController } from "./data-protection.controller.js";
import { recoveryExerciseSchema } from "./data-protection.schema.js";

const router = Router();
router.use(authenticate, authorize(Role.ADMIN));
router.get("/", getDataProtectionOverviewController);
router.post("/recovery-exercises", validateBody(recoveryExerciseSchema), recordRecoveryExerciseController);

export default router;
