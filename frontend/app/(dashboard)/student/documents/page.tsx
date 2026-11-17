import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { StudentPortalPage } from "../../../../features/student-portal/StudentPortalPage";

export default function StudentDocumentsPage() {
  return (
    <RoleGuard allowedRoles={["STUDENT"]}>
      <DashboardLayout>
        <StudentPortalPage
          title="Document Requests"
          description="Track certificates, transcript requests, and student records."
          endpoint="/me/documents"
          type="documents"
          emptyText="You have not requested any student documents yet."
        />
      </DashboardLayout>
    </RoleGuard>
  );
}
