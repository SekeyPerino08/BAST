"use client";

import { RoleGuard } from "../../../../components/RoleGuard";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { DataProtectionPage } from "../../../../features/data-protection/DataProtectionPage";

export default function AdminDataProtectionPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><DashboardLayout><DataProtectionPage /></DashboardLayout></RoleGuard>;
}
