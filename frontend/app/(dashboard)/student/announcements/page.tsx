import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { StudentPortalPage } from "../../../../features/student-portal/StudentPortalPage";

export default function StudentAnnouncementsPage() {
  return (
    <RoleGuard allowedRoles={["STUDENT"]}>
      <DashboardLayout>
        <StudentPortalPage
          title="Announcements"
          description="School and class updates published for your section and subjects."
          endpoint="/me/announcements"
          type="announcements"
          emptyText="There are no announcements for your section or subjects yet."
        />
      </DashboardLayout>
    </RoleGuard>
  );
}
