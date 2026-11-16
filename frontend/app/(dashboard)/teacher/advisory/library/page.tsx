import { DashboardLayout } from "../../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../../components/RoleGuard";
import { LibraryLoanList } from "../../../../../features/integrations/components/LibraryLoanList";

export default function AdviseeLibraryLoansPage() {
  return <RoleGuard allowedRoles={["TEACHER"]}><DashboardLayout><LibraryLoanList /></DashboardLayout></RoleGuard>;
}
