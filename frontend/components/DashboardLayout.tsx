"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  ClipboardList,
  FileClock,
  GraduationCap,
  LayoutDashboard,
  Menu,
  School,
  Settings,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { userDisplayName } from "../lib/auth";
import type { Role } from "../types/auth";
import { GlobalSearch } from "./GlobalSearch";

const navigation: Record<Role, { label: string; href: string; comingSoon?: boolean; group?: string }[]> = {
  ADMIN: [
    { label: "Dashboard", href: "/admin" },
    { label: "Students", href: "/admin/students" },
    { label: "Teachers / Faculty", href: "/admin/teachers" },
    { label: "Classes & Sections", href: "/admin/sections" },
    { label: "Subjects", href: "/admin/subjects" },
    { label: "School Years", href: "/admin/school-years" },
    { label: "Enrollment", href: "/admin/enrollment" },
    { label: "Data sync", href: "/admin/sync" },
    { label: "Profile", href: "/profile" },
    { label: "User Management", href: "/admin/users", group: "Administration" },
    { label: "Audit log", href: "/admin/audit-logs", group: "Administration" },
    { label: "Import", href: "/admin/imports", group: "Administration" },
    { label: "Reports", href: "/admin/reports", group: "Administration" },
  ],
  TEACHER: [
    { label: "Dashboard", href: "/teacher" },
    { label: "My Classes", href: "/teacher/classes" },
    { label: "Attendance", href: "/teacher/attendance" },
    { label: "Gradebook", href: "/teacher/grades" },
    { label: "Student List", href: "/teacher/advisory/report-cards" },
    { label: "Reports", href: "/teacher/reports" },
    { label: "Profile", href: "/profile" },
  ],
  STUDENT: [
    { label: "Dashboard", href: "/student" },
    { label: "My Classes", href: "/student/subjects" },
    { label: "Grades", href: "/student/grades" },
    { label: "Attendance", href: "/student/attendance" },
    { label: "Report Card", href: "/student/report-card" },
    { label: "Profile", href: "/profile" },
  ],
  ALUMNI: [
    { label: "Dashboard", href: "/alumni" },
    { label: "My Data", href: "/alumni/data" },
    { label: "Courses", href: "/courses" },
    { label: "Profile", href: "/profile" },
  ],
};

const navigationIcons: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Students: Users,
  Teachers: GraduationCap,
  "Teachers / Faculty": GraduationCap,
  Sections: School,
  "Classes & Sections": School,
  Courses: BookOpen,
  Subjects: BookOpen,
  "School Years": CalendarCheck,
  Enrollment: ClipboardList,
  "Data sync": LayoutDashboard,
  Profile: UserRound,
  Users,
  "User Management": Users,
  "Audit log": FileClock,
  Import: ClipboardList,
  Reports: BarChart3,
  "My Classes": School,
  "Student List": Users,
  Attendance: CalendarCheck,
  Grades: ClipboardList,
  Gradebook: ClipboardList,
  "My Subjects": BookOpen,
  "My Grades": ClipboardList,
  "My Data": LayoutDashboard,
  "My Attendance": CalendarCheck,
  "Report Card": FileClock,
};

export function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const mobileNavigationRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCollapseTimer = () => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = null;
  };
  const scheduleCollapse = () => {
    clearCollapseTimer();
    collapseTimerRef.current = setTimeout(() => {
      const sidebar = sidebarRef.current;
      if (sidebar?.matches(":hover") || sidebar?.contains(document.activeElement)) return;
      setSidebarCollapsed(true);
    }, 3000);
  };
  useEffect(() => {
    if (sidebarCollapsed) {
      clearCollapseTimer();
      return;
    }
    collapseTimerRef.current = setTimeout(() => {
      const sidebar = sidebarRef.current;
      if (sidebar?.matches(":hover") || sidebar?.contains(document.activeElement)) return;
      setSidebarCollapsed(true);
    }, 3000);
    return clearCollapseTimer;
  }, [sidebarCollapsed]);
  useEffect(() => {
    if (user?.mustChangePassword) router.replace("/change-password");
  }, [router, user]);
  useEffect(() => {
    const closeOnHistoryNavigation = () => setMenuOpen(false);
    window.addEventListener("popstate", closeOnHistoryNavigation);
    return () => window.removeEventListener("popstate", closeOnHistoryNavigation);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const openingElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const navigation = mobileNavigationRef.current;
    navigation?.querySelector<HTMLElement>("button:not([disabled]), a[href]")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key !== "Tab" || !navigation) return;
      const focusable = Array.from(navigation.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      if (openingElement?.isConnected) openingElement.focus();
    };
  }, [menuOpen]);
  if (!user || user.mustChangePassword) return null;

  const links = navigation[user.role];
  const primaryLinks = links.filter((link) => !("group" in link));
  const administrationLinks = links.filter((link) => "group" in link);
  const sidebar = (
    <aside
      ref={sidebarRef}
      onMouseEnter={clearCollapseTimer}
      onMouseLeave={scheduleCollapse}
      onFocus={clearCollapseTimer}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) scheduleCollapse();
      }}
      className={`flex h-full w-72 flex-col border-r border-[#0d412e]/60 bg-[linear-gradient(180deg,_#0d412e_0%,_#0f5b38_100%)] text-white transition-[width] duration-200 ${sidebarCollapsed ? "lg:w-[5.5rem]" : "lg:w-72"}`}
    >
      <div className={`flex h-24 items-center gap-3 border-b border-white/10 px-4 ${sidebarCollapsed ? "lg:justify-center lg:px-0" : "sm:px-5"}`}>
        <button
          type="button"
          onClick={() => {
            setSidebarCollapsed((collapsed) => !collapsed);
            setMenuOpen(false);
          }}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={sidebarCollapsed}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex min-w-0 items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c35d]"
        >
          <Image src="/BAST1.jpg" alt="BAST logo" width={56} height={56} priority className={`size-14 shrink-0 rounded-full object-cover ring-2 ring-white/60 ${sidebarCollapsed ? "lg:size-12" : ""}`} />
          <span className={`min-w-0 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
            <span className="block max-w-40 text-sm font-bold leading-tight text-white">Benthel Asia School of Technology Inc.</span>
          </span>
        </button>
        <button
          type="button"
          className="ml-auto rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation menu"
          tabIndex={menuOpen ? 0 : -1}
        >
          <X size={20} />
        </button>
      </div>
      <div className={`flex items-center gap-2 border-b border-white/10 p-3 ${sidebarCollapsed ? "lg:flex-col lg:items-center lg:px-2" : ""}`}>
        <GlobalSearch compact={sidebarCollapsed} />
      </div>
      <nav className={`sidebar-navigation-scroll flex-1 space-y-1 overflow-y-auto p-3 ${sidebarCollapsed ? "lg:px-2" : ""}`} aria-label="Main navigation">
        {primaryLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== "/admin" && link.href !== "/teacher" && link.href !== "/student" && pathname.startsWith(`${link.href}/`));
          const Icon = navigationIcons[link.label] ?? LayoutDashboard;
          return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMenuOpen(false)}
            aria-current={isActive ? "page" : undefined}
            aria-label={sidebarCollapsed ? link.label : undefined}
            title={sidebarCollapsed ? link.label : undefined}
            className={`relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              isActive
                ? "bg-[#1d6a45] text-white shadow-sm before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-[#f0c35d]"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            } ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""}`}
          >
            <Icon aria-hidden="true" size={19} className={isActive ? "text-[#f0c35d]" : "text-slate-300"} />
            <span className={sidebarCollapsed ? "lg:hidden" : ""}>{link.label}</span>
            {link.comingSoon && !sidebarCollapsed && (
              <span className="text-xs font-normal text-slate-400">Coming soon</span>
            )}
          </Link>
        );})}
        {administrationLinks.length > 0 && <div className="mt-6 border-t border-white/10 pt-4">
          <p className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 ${sidebarCollapsed ? "lg:hidden" : ""}`}>Administration</p>
          {administrationLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = navigationIcons[link.label] ?? Settings;
            return <Link key={link.href} href={link.href} aria-label={sidebarCollapsed ? link.label : undefined} title={sidebarCollapsed ? link.label : undefined} onClick={() => setMenuOpen(false)}
              aria-current={isActive ? "page" : undefined}
              className={`relative mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? "bg-[#1d6a45] text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-[#f0c35d]" : "text-slate-300 hover:bg-white/10 hover:text-white"} ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""}`}>
              <Icon aria-hidden="true" size={19} className={isActive ? "text-[#f0c35d]" : "text-slate-300"} />
              <span className={sidebarCollapsed ? "lg:hidden" : ""}>{link.label}</span>
            </Link>;
          })}
        </div>}
      </nav>
      <div className="border-t border-white/10 p-3">
        <details ref={menuRef} className="relative">
          <summary aria-label="Open user menu" className={`flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl bg-white/[0.07] p-2 text-left hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#f0c35d] [&::-webkit-details-marker]:hidden ${sidebarCollapsed ? "lg:justify-center" : ""}`}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1d6a45] text-sm font-bold text-[#f0c35d]" aria-hidden="true">
              {userDisplayName(user).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
            </span>
            <span className={`min-w-0 flex-1 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
              <span className="block truncate text-xs font-semibold text-white">{userDisplayName(user)}</span>
              <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">{user.role.toLowerCase()}</span>
            </span>
            <ChevronDown size={15} aria-hidden="true" className={`text-slate-400 ${sidebarCollapsed ? "lg:hidden" : ""}`} />
          </summary>
          <div className={`absolute bottom-full left-0 z-30 mb-2 w-full rounded-xl border border-white/15 bg-[#0d412e] p-2 shadow-xl ${sidebarCollapsed ? "lg:left-full lg:ml-2 lg:w-64" : ""}`}>
            <div className="border-b border-white/10 px-3 py-2">
              <p className="truncate text-sm font-semibold text-white">{user.email}</p>
              <p className="mt-1 text-xs text-slate-300">{user.role}</p>
            </div>
            <Link href="/profile" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}
              className="mt-1 block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#f0c35d]">
              Profile
            </Link>
            <button type="button" onClick={() => void logout()}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#f0c35d]">
              Log out
            </button>
          </div>
        </details>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#f4f6fa] dark:bg-slate-950">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold text-[#0d412e] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus-visible:outline-2 focus-visible:outline-[#1d6a45]"
      >
        Skip to content
      </a>
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">{sidebar}</div>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setMenuOpen(false)}
          />
          <div ref={mobileNavigationRef} className="relative h-full" role="dialog" aria-modal="true" aria-label="Main navigation">
            {sidebar}
          </div>
        </div>
      )}
      {!menuOpen && <button
        type="button"
        className="fixed left-3 top-3 z-30 inline-flex size-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#0d412e] shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#1d6a45] lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        onClick={() => setMenuOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={menuOpen}
      >
        <Menu size={22} />
      </button>}
      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main-content" tabIndex={-1} className="w-full flex-1 p-4 pt-16 focus:outline-none sm:p-8 sm:pt-8">{children}</main>
      </div>
    </div>
  );
}
