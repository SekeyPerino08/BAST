"use client";

import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Menu, X, GraduationCap, ChevronDown, UserRound, Moon, Sun, LogOut } from "lucide-react";
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
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
        <Link
          href={user.role === "ADMIN" ? "/admin" : user.role === "TEACHER" ? "/teacher" : user.role === "ALUMNI" ? "/alumni" : "/student"}
          onClick={() => setMenuOpen(false)}
          aria-label="CampusHub home"
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <span className="rounded-xl bg-indigo-600 p-2 text-white">
            <GraduationCap aria-hidden="true" size={22} />
          </span>
          <span className="truncate font-semibold text-slate-900">CampusHub</span>
        </Link>
        <button
          type="button"
          className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation menu"
          tabIndex={menuOpen ? 0 : -1}
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Main navigation">
        {primaryLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== "/admin" && link.href !== "/teacher" && link.href !== "/student" && pathname.startsWith(`${link.href}/`));
          return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMenuOpen(false)}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium ${
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span>{link.label}</span>
            {link.comingSoon && (
              <span className="text-xs font-normal text-slate-400">Coming soon</span>
            )}
          </Link>
        );})}
        {administrationLinks.length > 0 && <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Administration</p>
          {administrationLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
              aria-current={isActive ? "page" : undefined}
              className={`mb-1 flex rounded-xl px-4 py-3 text-sm font-medium ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}>
              {link.label}
            </Link>;
          })}
        </div>}
      </nav>
      <div className="border-t border-slate-100 p-4 text-xs text-slate-400">
        School Management System
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold text-indigo-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus-visible:outline-2 focus-visible:outline-indigo-600"
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
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-8">
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
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <div className="hidden text-sm text-slate-500 sm:block">School Management System</div>
              {user.role === "ADMIN" && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600" aria-label="Current school year">
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
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">
              {darkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => void logout()} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">
              <LogOut size={17} aria-hidden="true" /><span className="hidden sm:inline">Sign out</span>
            </button>
            <details ref={menuRef} className="relative">
              <summary aria-label="Open user menu" className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 [&::-webkit-details-marker]:hidden">
                <span className="hidden text-right sm:block">
                  <span className="block max-w-48 truncate text-sm font-semibold text-slate-900">{userDisplayName(user)}</span>
                  <span className="block text-xs text-slate-500">{user.role}</span>
                </span>
                <UserRound size={18} aria-hidden="true" className="text-indigo-700" />
                <ChevronDown size={15} aria-hidden="true" className="text-slate-500" />
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-500">{user.role}</p>
                </div>
                <Link href="/profile" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}
                  className="mt-1 block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600">
                  Profile
                </Link>
                <button type="button" onClick={() => void logout()}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600">
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
