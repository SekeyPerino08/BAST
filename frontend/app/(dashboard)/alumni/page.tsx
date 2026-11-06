"use client";

import Link from "next/link";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { RoleGuard } from "../../../components/RoleGuard";

export default function AlumniDashboardPage() {
  return (
    <RoleGuard allowedRoles={["ALUMNI"]}>
      <DashboardLayout>
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Alumni portal</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-2 text-slate-600">View your learning activity, library loans, and alumni engagement records.</p>
          <Link href="/alumni/data" className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">View my data</Link>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
