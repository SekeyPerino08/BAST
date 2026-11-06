"use client";

import { RoleGuard } from "../../../../components/RoleGuard";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { DataSyncPage } from "../../../../features/integrations/components/DataSyncPage";

export default function AdminSyncPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <DashboardLayout><DataSyncPage /></DashboardLayout>
    </RoleGuard>
  );
}
