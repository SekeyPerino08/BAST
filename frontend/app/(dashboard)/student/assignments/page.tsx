import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { StudentPortalPage } from "../../../../features/student-portal/StudentPortalPage";

export default function StudentAssignmentsPage() {
  return (
    <RoleGuard allowedRoles={["STUDENT"]}>
      <DashboardLayout>
        <StudentPortalPage
          title="Assignments"
          description="Track your upcoming, submitted, and overdue schoolwork."
          endpoint="/me/assignments"
          type="assignments"
          emptyText="You do not have any assignments for the current school year yet."
        />
      </DashboardLayout>
    </RoleGuard>
  );
}
