import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { TeacherClassesView } from "../../../../features/class-offerings/components/TeacherClassesView";

export default function TeacherAttendancePage() {
  return (
    <RoleGuard allowedRoles={["TEACHER"]}>
      <DashboardLayout>
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">Attendance</p>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My attendance</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">Review your assigned classes and open the attendance sheet for any class roster.</p>
          </header>
          <TeacherClassesView />
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
