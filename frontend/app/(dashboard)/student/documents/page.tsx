import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { StudentDocumentRequestsPage } from "../../../../features/document-requests/StudentDocumentRequestsPage";

export default function StudentDocumentsPage() {
  return (
    <RoleGuard allowedRoles={["STUDENT"]}>
      <DashboardLayout><StudentDocumentRequestsPage /></DashboardLayout>
    </RoleGuard>
  );
}
