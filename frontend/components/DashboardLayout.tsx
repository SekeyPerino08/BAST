"use client";

import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileClock,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  School,
  Settings,
  Sun,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { userDisplayName } from "../lib/auth";
import type { Role } from "../types/auth";
import { useCurrentSchoolYear } from "../features/school-years/hooks";
import { GlobalSearch } from "./GlobalSearch";

const navigation: Record<Role, { label: string; href: string; comingSoon?: boolean; group?: string }[]> = {
  ADMIN: [
    { label: "Dashboard", href: "/admin" },
    { label: "Students", href: "/admin/students" },
    { label: "Teachers", href: "/admin/teachers" },
    { label: "Sections", href: "/admin/sections" },
    { label: "Courses", href: "/courses" },
    { label: "School Years", href: "/admin/school-years" },
    { label: "Enrollment", href: "/admin/enrollment" },
    { label: "Data sync", href: "/admin/sync" },
    { label: "Profile", href: "/profile" },
    { label: "Users", href: "/admin/users", group: "Administration" },
    { label: "Audit log", href: "/admin/audit-logs", group: "Administration" },
    { label: "Import", href: "/admin/imports", group: "Administration" },
    { label: "Reports", href: "/admin/reports", group: "Administration" },
  ],
  TEACHER: [
    { label: "Dashboard", href: "/teacher" },
    { label: "My Classes", href: "/teacher/classes" },
    { label: "Courses", href: "/courses" },
    { label: "Attendance", href: "/teacher/attendance" },
    { label: "Grades", href: "/teacher/grades" },
    { label: "Reports", href: "/teacher/reports" },
    { label: "Profile", href: "/profile" },
  ],
  STUDENT: [
    { label: "Dashboard", href: "/student" },
    { label: "My Subjects", href: "/student/subjects" },
    { label: "Courses", href: "/courses" },
    { label: "My Grades", href: "/student/grades" },
    { label: "My Data", href: "/student/integrations" },
    { label: "My Attendance", href: "/student/attendance" },
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
  Sections: School,
  Courses: BookOpen,
  "School Years": CalendarCheck,
  Enrollment: ClipboardList,
  "Data sync": LayoutDashboard,
  Profile: UserRound,
  Users,
  "Audit log": FileClock,
  Import: ClipboardList,
  Reports: BarChart3,
  "My Classes": School,
  Attendance: CalendarCheck,
  Grades: ClipboardList,
  "My Subjects": BookOpen,
  "My Grades": ClipboardList,
  "My Data": LayoutDashboard,
  "My Attendance": CalendarCheck,
  "Report Card": FileClock,
};

function subscribeToTheme(onChange: () => void) {
  window.addEventListener("campushub-theme-change", onChange);
  return () => window.removeEventListener("campushub-theme-change", onChange);
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

export function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const currentSchoolYear = useCurrentSchoolYear();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const darkMode = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const mobileNavigationRef = useRef<HTMLDivElement>(null);
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
    <aside className={`flex h-full w-72 flex-col border-r border-[#263d60] bg-[#102747] text-white transition-[width] duration-200 ${sidebarCollapsed ? "lg:w-[5.5rem]" : "lg:w-72"}`}>
      <div className={`flex h-24 items-center gap-3 border-b border-white/10 px-4 ${sidebarCollapsed ? "lg:justify-center" : "sm:px-5"}`}>
        <Link
          href={user.role === "ADMIN" ? "/admin" : user.role === "TEACHER" ? "/teacher" : user.role === "ALUMNI" ? "/alumni" : "/student"}
          onClick={() => setMenuOpen(false)}
          aria-label="Marigondon National High School home"
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3c64e]"
        >
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#fffdf5] p-1.5 shadow-sm">
            <Image src="/MNHS%20logo.jpg" alt="Marigondon National High School seal" width={52} height={54} priority className="size-full object-contain" />
          </span>
          <span className={`min-w-0 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#f3c64e]">CampusHub</span>
            <span className="mt-1 block max-w-40 text-sm font-bold leading-tight text-white">Marigondon National High School</span>
          </span>
        </Link>
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
      <nav className={`flex-1 space-y-1 overflow-y-auto p-3 ${sidebarCollapsed ? "lg:px-2" : ""}`} aria-label="Main navigation">
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
                ? "bg-[#285487] text-white shadow-sm before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-[#f3c64e]"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon aria-hidden="true" size={19} className={isActive ? "text-[#f3c64e]" : "text-slate-300"} />
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
              className={`relative mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? "bg-[#285487] text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-[#f3c64e]" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
              <Icon aria-hidden="true" size={19} className={isActive ? "text-[#f3c64e]" : "text-slate-300"} />
              <span className={sidebarCollapsed ? "lg:hidden" : ""}>{link.label}</span>
            </Link>;
          })}
        </div>}
      </nav>
      <div className={`border-t border-white/10 p-3 ${sidebarCollapsed ? "lg:flex lg:justify-center" : ""}`}>
        <div className={`flex min-w-0 items-center gap-3 rounded-xl bg-white/[0.07] p-3 ${sidebarCollapsed ? "lg:justify-center" : ""}`}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#285487] text-sm font-bold text-[#f3c64e]" aria-hidden="true">
            {userDisplayName(user).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
          </span>
          <span className={`min-w-0 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
            <span className="block truncate text-xs font-semibold text-white">{userDisplayName(user)}</span>
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">{user.role.toLowerCase()}</span>
          </span>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#f4f6fa] dark:bg-slate-950">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold text-[#17365d] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus-visible:outline-2 focus-visible:outline-[#285487]"
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
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[4.5rem] items-center justify-between border-b border-slate-200 bg-white/95 px-3 shadow-[0_1px_3px_rgba(16,39,71,0.04)] backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
            >
              <Menu size={22} />
            </button>
            <button type="button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              className="hidden size-9 items-center justify-center rounded-lg border border-slate-200 text-[#17365d] transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#285487] lg:inline-flex dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={sidebarCollapsed}>
              {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            </button>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <div className="hidden text-sm font-semibold text-[#17365d] sm:block dark:text-slate-100">Marigondon National High School</div>
              {user.role === "ADMIN" && <span className="hidden rounded-full bg-[#fff7df] px-2.5 py-1 text-xs font-semibold text-[#77570a] sm:inline-flex" aria-label="Current school year">
                {currentSchoolYear.data?.data.name ?? (currentSchoolYear.isLoading ? "Loading school year…" : "No current school year")}
              </span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <button type="button" onClick={() => {
              const next = !document.documentElement.classList.contains("dark");
              document.documentElement.classList.toggle("dark", next);
              window.localStorage.setItem("campushub-theme", next ? "dark" : "light");
              window.dispatchEvent(new Event("campushub-theme-change"));
            }} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-300 text-[#17365d] hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#285487] dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              {darkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => void logout()} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#17365d] hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#285487] dark:text-slate-200 dark:hover:bg-slate-800">
              <LogOut size={17} aria-hidden="true" /><span className="hidden sm:inline">Sign out</span>
            </button>
            <details ref={menuRef} className="relative">
              <summary aria-label="Open user menu" className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#285487] [&::-webkit-details-marker]:hidden">
                <span className="hidden text-right sm:block">
                  <span className="block max-w-48 truncate text-sm font-semibold text-slate-900">{userDisplayName(user)}</span>
                  <span className="block text-xs text-slate-500">{user.role}</span>
                </span>
                <UserRound size={18} aria-hidden="true" className="text-[#285487]" />
                <ChevronDown size={15} aria-hidden="true" className="text-slate-500" />
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-500">{user.role}</p>
                </div>
                <Link href="/profile" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}
                  className="mt-1 block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#285487]">
                  Profile
                </Link>
                <button type="button" onClick={() => void logout()}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#285487]">
                  Log out
                </button>
              </div>
            </details>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="w-full flex-1 p-4 focus:outline-none sm:p-8">{children}</main>
      </div>
    </div>
  );
}
