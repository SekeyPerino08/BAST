import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { TeacherClassesView } from "../../../../features/class-offerings/components/TeacherClassesView";

export default function TeacherAttendancePage() {
  return (
    <RoleGuard allowedRoles={["TEACHER"]}>
      <DashboardLayout>
        <TeacherClassesView purpose="attendance" />
      </DashboardLayout>
    </RoleGuard>
  );
}
