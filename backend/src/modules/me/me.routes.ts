import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate, authenticateAllowPending } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  createMyDocumentRequestController,
  getMyAcademicHistoryController,
  getMyAdvisoryStudentsController,
  getMyAnnouncementsController,
  getMyAssignmentsController,
  getMyClassesController,
  getMyDocumentRequestsController,
  getMyEnrollmentController,
  getMyLearningMaterialsController,
  getMyNotificationsController,
  getMyProfileController,
  getMyScheduleController,
  markMyNotificationReadController,
} from "./me.controller.js";
import { getMyAttendanceController } from "../attendance/attendance.controller.js";
import {
  getMyStudentAlumniController,
  getMyStudentLibraryController,
  getMyStudentLmsController,
} from "../integrations/integration.controller.js";

const router = Router();
router.get("/profile", authenticateAllowPending, getMyProfileController);
router.use(authenticate);
router.get("/classes", authorize(Role.TEACHER), getMyClassesController);
router.get("/advisory/students", authorize(Role.TEACHER), getMyAdvisoryStudentsController);
router.get("/enrollment", authorize(Role.STUDENT), getMyEnrollmentController);
router.get("/assignments", authorize(Role.STUDENT), getMyAssignmentsController);
router.get("/announcements", authorize(Role.STUDENT), getMyAnnouncementsController);
router.get("/schedule", authorize(Role.STUDENT), getMyScheduleController);
router.get("/materials", authorize(Role.STUDENT), getMyLearningMaterialsController);
router.get("/documents", authorize(Role.STUDENT), getMyDocumentRequestsController);
router.post("/documents", authorize(Role.STUDENT), createMyDocumentRequestController);
router.get("/notifications", authorize(Role.STUDENT), getMyNotificationsController);
router.patch("/notifications/:id/read", authorize(Role.STUDENT), markMyNotificationReadController);
router.get("/history", authorize(Role.STUDENT), getMyAcademicHistoryController);
router.get("/attendance", authorize(Role.STUDENT), getMyAttendanceController);
router.get("/lms", authorize(Role.STUDENT, Role.ALUMNI), getMyStudentLmsController);
router.get("/library", authorize(Role.STUDENT, Role.ALUMNI), getMyStudentLibraryController);
router.get("/alumni", authorize(Role.ALUMNI), getMyStudentAlumniController);

export default router;
