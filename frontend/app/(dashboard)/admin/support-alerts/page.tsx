"use client";

import { RoleGuard } from "../../../../components/RoleGuard";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { SupportAlertsPage } from "../../../../features/student-support/SupportAlertsPage";

export default function AdminSupportAlertsPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><DashboardLayout><SupportAlertsPage /></DashboardLayout></RoleGuard>;
}
