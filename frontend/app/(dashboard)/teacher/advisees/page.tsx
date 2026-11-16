import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { TeacherAdviseesView } from "../../../../features/teacher-advisory/components/TeacherAdviseesView";

export default function TeacherAdviseesPage() {
  return (
    <RoleGuard allowedRoles={["TEACHER"]}>
      <DashboardLayout>
        <TeacherAdviseesView />
      </DashboardLayout>
    </RoleGuard>
  );
}
