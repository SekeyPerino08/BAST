import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { StudentPortalPage } from "../../../../features/student-portal/StudentPortalPage";

export default function StudentNotificationsPage() {
  return (
    <RoleGuard allowedRoles={["STUDENT"]}>
      <DashboardLayout>
        <StudentPortalPage
          title="Notifications"
          description="Your latest announcements, reminders, and school updates."
          endpoint="/me/notifications"
          type="notifications"
          emptyText="You do not have any notifications at the moment."
        />
      </DashboardLayout>
    </RoleGuard>
  );
}
