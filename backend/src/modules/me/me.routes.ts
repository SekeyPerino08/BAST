import { Role } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { authenticate, authenticateAllowPending } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { AppError } from "../../utils/AppError.js";
import {
  createMyDocumentRequestController,
  getMyAcademicHistoryController,
  getMyAdvisoryStudentsController,
  getMyAnnouncementsController,
  getMyClassesController,
  getMyDocumentRequestsController,
  getMyEnrollmentController,
  getMyNotificationsController,
  getMyProfileController,
  getMyProfilePhotoController,
  getMyScheduleController,
  markMyNotificationReadController,
  updateMyProfileController,
} from "./me.controller.js";
import { updateMyProfileSchema } from "./me.schema.js";
import { getMyAttendanceController } from "../attendance/attendance.controller.js";
import { createStudentDocumentRequestSchema } from "../document-requests/document-request.schema.js";
import {
  getMyStudentAlumniController,
  getMyStudentLibraryController,
  getMyStudentLmsController,
} from "../integrations/integration.controller.js";

const router = Router();
router.get("/profile", authenticateAllowPending, getMyProfileController);
router.get("/profile/photo", authenticateAllowPending, getMyProfilePhotoController);
const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new AppError("Upload a JPG, PNG, or WebP image", 400, "INVALID_PROFILE_PHOTO"));
      return;
    }
    callback(null, true);
  },
});
router.patch(
  "/profile",
  authenticateAllowPending,
  profilePhotoUpload.single("photo"),
  validateBody(updateMyProfileSchema),
  updateMyProfileController,
);
router.use(authenticate);
router.get("/classes", authorize(Role.TEACHER), getMyClassesController);
router.get("/advisory/students", authorize(Role.TEACHER), getMyAdvisoryStudentsController);
router.get("/enrollment", authorize(Role.STUDENT), getMyEnrollmentController);
router.get("/announcements", authorize(Role.STUDENT), getMyAnnouncementsController);
router.get("/schedule", authorize(Role.STUDENT), getMyScheduleController);
router.get("/documents", authorize(Role.STUDENT), getMyDocumentRequestsController);
router.post("/documents", authorize(Role.STUDENT), validateBody(createStudentDocumentRequestSchema), createMyDocumentRequestController);
router.get("/notifications", authorize(Role.STUDENT), getMyNotificationsController);
router.patch("/notifications/:id/read", authorize(Role.STUDENT), markMyNotificationReadController);
router.get("/history", authorize(Role.STUDENT), getMyAcademicHistoryController);
router.get("/attendance", authorize(Role.STUDENT), getMyAttendanceController);
router.get("/lms", authorize(Role.STUDENT, Role.ALUMNI), getMyStudentLmsController);
router.get("/library", authorize(Role.STUDENT, Role.ALUMNI), getMyStudentLibraryController);
router.get("/alumni", authorize(Role.ALUMNI), getMyStudentAlumniController);

export default router;
