"use client";

import { DashboardLayout } from "../../../components/DashboardLayout";
import { RoleGuard } from "../../../components/RoleGuard";
import { useAuth } from "../../../providers/AuthProvider";
import { SubjectsList } from "../../../features/subjects/components/SubjectsList";

function CoursesContent() {
  const { user } = useAuth();
  return <DashboardLayout><SubjectsList readOnly={user?.role !== "ADMIN"} title="Courses" /></DashboardLayout>;
}

export default function CoursesPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN", "TEACHER", "STUDENT", "ALUMNI"]}>
      <CoursesContent />
    </RoleGuard>
  );
}
