import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { AdminDocumentRequestsPage } from "../../../../features/document-requests/AdminDocumentRequestsPage";

export default function AdminDocumentRequestsRoute() {
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <DashboardLayout><AdminDocumentRequestsPage /></DashboardLayout>
    </RoleGuard>
  );
}
