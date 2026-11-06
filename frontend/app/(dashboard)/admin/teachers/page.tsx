"use client";

import { RoleGuard } from "../../../../components/RoleGuard";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { TeachersList } from "../../../../features/teachers/components/TeachersList";

export default function AdminTeachersPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><DashboardLayout><TeachersList /></DashboardLayout></RoleGuard>;
}
