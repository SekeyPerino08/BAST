"use client";

import { DashboardLayout } from "../../../components/DashboardLayout";
import { RoleGuard } from "../../../components/RoleGuard";
import { AdminDashboardView } from "./AdminDashboardView";

export default function AdminDashboardPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <DashboardLayout>
        <AdminDashboardView />
      </DashboardLayout>
    </RoleGuard>
  );
}
