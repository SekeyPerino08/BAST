import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { StudentPortalPage } from "../../../../features/student-portal/StudentPortalPage";

export default function StudentSchedulePage() {
  return (
    <RoleGuard allowedRoles={["STUDENT"]}>
      <DashboardLayout>
        <StudentPortalPage
          title="Class Schedule"
          description="Your class timetable for the active school year."
          endpoint="/me/schedule"
          type="schedule"
          emptyText="Your class schedule has not been posted for the current school year yet."
        />
      </DashboardLayout>
    </RoleGuard>
  );
}
