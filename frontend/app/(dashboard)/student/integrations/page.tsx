"use client";

import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { StudentIntegrations } from "../../../../features/integrations/components/StudentIntegrations";

export default function StudentIntegrationsPage() {
  return (
    <RoleGuard allowedRoles={["STUDENT"]}>
      <DashboardLayout>
        <div className="mx-auto max-w-5xl space-y-5">
          <header><p className="text-sm font-semibold uppercase tracking-wide text-[#1d6a45] dark:text-[#dfeee4]">Student portal</p><h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">My learning data</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your recent LMS activity and library loans.</p></header>
          <StudentIntegrations showAlumni={false} />
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
