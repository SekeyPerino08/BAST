"use client";

import { RoleGuard } from "../../../../components/RoleGuard";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { SupportAlertsPage } from "../../../../features/student-support/SupportAlertsPage";

export default function TeacherSupportAlertsPage() {
  return <RoleGuard allowedRoles={["TEACHER"]}><DashboardLayout><SupportAlertsPage /></DashboardLayout></RoleGuard>;
}
