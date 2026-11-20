import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { StudentPortalPage } from "../../../../features/student-portal/StudentPortalPage";

export default function StudentHistoryPage() {
  return (
    <RoleGuard allowedRoles={["STUDENT"]}>
      <DashboardLayout>
        <StudentPortalPage
          title="Academic History"
          description="View your released marks and term-by-term academic progress."
          endpoint="/me/history"
          type="history"
          emptyText="No academic records are available yet for the current student profile."
        />
      </DashboardLayout>
    </RoleGuard>
  );
}
