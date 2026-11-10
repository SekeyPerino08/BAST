"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { dashboardPath } from "../lib/auth";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? dashboardPath(user.role) : "/login");
  }, [loading, router, user]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#edf7ef_0%,_#dfeee4_15%,_#0d412e_100%)] px-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#dfeee4] border-t-[#1d6a45]" aria-label="Loading" />
    </main>
  );
}
