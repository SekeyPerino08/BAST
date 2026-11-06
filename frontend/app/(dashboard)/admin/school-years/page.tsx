"use client";
import { RoleGuard } from "../../../../components/RoleGuard";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { SchoolYearsList } from "../../../../features/school-years/components/SchoolYearsList";
export default function AdminSchoolYearsPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><DashboardLayout><SchoolYearsList /></DashboardLayout></RoleGuard>;
}
