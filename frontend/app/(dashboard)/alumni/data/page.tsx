"use client";

import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { StudentIntegrations } from "../../../../features/integrations/components/StudentIntegrations";

export default function AlumniDataPage() {
  return (
    <RoleGuard allowedRoles={["ALUMNI"]}>
      <DashboardLayout>
        <div className="mx-auto max-w-5xl space-y-5">
          <header><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Alumni portal</p><h1 className="mt-1 text-3xl font-bold text-slate-900">My data</h1><p className="mt-1 text-sm text-slate-500">Your learning history, library loans, and alumni engagement.</p></header>
          <StudentIntegrations showAlumni />
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
