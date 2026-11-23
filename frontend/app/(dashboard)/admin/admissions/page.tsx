"use client";

import { RoleGuard } from "../../../../components/RoleGuard";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { AdmissionsPage } from "../../../../features/admissions/AdmissionsPage";

export default function AdminAdmissionsPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <DashboardLayout><AdmissionsPage /></DashboardLayout>
    </RoleGuard>
  );
}
