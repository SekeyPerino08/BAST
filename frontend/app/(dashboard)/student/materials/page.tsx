import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { StudentPortalPage } from "../../../../features/student-portal/StudentPortalPage";

export default function StudentMaterialsPage() {
  return (
    <RoleGuard allowedRoles={["STUDENT"]}>
      <DashboardLayout>
        <StudentPortalPage
          title="Learning Materials"
          description="Downloads and resources shared by your teachers."
          endpoint="/me/materials"
          type="materials"
          emptyText="No learning materials have been shared with you yet."
        />
      </DashboardLayout>
    </RoleGuard>
  );
}
