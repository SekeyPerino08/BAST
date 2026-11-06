"use client";

import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { StudentIntegrations } from "../../../../features/integrations/components/StudentIntegrations";

export default function StudentIntegrationsPage() {
  return (
    <RoleGuard allowedRoles={["STUDENT"]}>
      <DashboardLayout>
        <div className="mx-auto max-w-5xl space-y-5">
          <header><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Student portal</p><h1 className="mt-1 text-3xl font-bold text-slate-900">My learning data</h1><p className="mt-1 text-sm text-slate-500">Your recent LMS activity and library loans.</p></header>
          <StudentIntegrations showAlumni={false} />
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
