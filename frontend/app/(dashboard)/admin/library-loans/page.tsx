import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { LibraryLoanList } from "../../../../features/integrations/components/LibraryLoanList";

export default function AdminLibraryLoansPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><DashboardLayout><LibraryLoanList /></DashboardLayout></RoleGuard>;
}
