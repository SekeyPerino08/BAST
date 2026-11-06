"use client";
import { RoleGuard } from "../../../../components/RoleGuard";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { SectionsList } from "../../../../features/sections/components/SectionsList";
export default function AdminSectionsPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><DashboardLayout><SectionsList /></DashboardLayout></RoleGuard>;
}
