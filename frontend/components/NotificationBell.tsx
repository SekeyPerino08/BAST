"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError, apiFetch } from "../lib/api";

type Notification = {
  id: string;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell({ userId, role }: Readonly<{ userId: string; role: "ADMIN" | "STUDENT" }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const seenIds = useRef<Set<string> | null>(null);
  const notifications = useQuery({
    queryKey: ["my-notifications", userId],
    queryFn: () => apiFetch<{ data: Notification[] }>("/api/me/notifications"),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/me/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-notifications", userId] }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not mark notification as read"),
  });

  useEffect(() => {
    const rows = notifications.data?.data;
    if (!rows) return;
    if (seenIds.current) {
      for (const notification of rows) {
        if (!seenIds.current.has(notification.id)) {
          toast.info(notification.title, { description: notification.message, duration: 8000 });
        }
      }
    }
    seenIds.current = new Set(rows.map((notification) => notification.id));
  }, [notifications.data]);

  const rows = notifications.data?.data ?? [];
  const unreadCount = rows.filter((notification) => !notification.isRead).length;

  function openNotification(notification: Notification) {
    if (!notification.isRead) markRead.mutate(notification.id);
    setOpen(false);
    if (notification.actionUrl?.startsWith("/") && !notification.actionUrl.startsWith("//")) {
      router.push(notification.actionUrl);
    }
  }

  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog"
      aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
      className="relative inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#1d6a45] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
      <Bell size={19} aria-hidden="true" />
      {unreadCount > 0 && <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-5 text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
    </button>
    {open && <section role="dialog" aria-label="Recent notifications" className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 className="font-semibold text-slate-900 dark:text-white">Notifications</h2>
        <span className="text-xs text-slate-500">{unreadCount} unread</span>
      </div>
      {notifications.isLoading ? <p role="status" className="p-4 text-sm text-slate-500">Loading notifications…</p>
        : notifications.isError ? <div className="p-4 text-sm text-rose-700">
          <p>Could not load notifications.</p>
          <button type="button" onClick={() => void notifications.refetch()} className="mt-2 font-semibold underline">Try again</button>
        </div>
          : !rows.length ? <p className="p-4 text-sm text-slate-500">No notifications yet.</p>
            : <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {rows.slice(0, 8).map((notification) => <li key={notification.id}>
                <button type="button" onClick={() => openNotification(notification)} className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-slate-900 dark:text-white">{notification.title}</span>
                    {!notification.isRead && <span className="mt-1 size-2 shrink-0 rounded-full bg-emerald-600" aria-label="Unread" />}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{notification.message}</span>
                  <span className="mt-2 block text-xs text-slate-500">{formatDate(notification.createdAt)}</span>
                </button>
              </li>)}
            </ul>}
      <button type="button" onClick={() => { setOpen(false); router.push(role === "ADMIN" ? "/admin/document-requests" : "/student/documents"); }} className="w-full border-t border-slate-200 px-4 py-3 text-left text-sm font-semibold text-indigo-700 hover:bg-slate-50 dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-slate-800">{role === "ADMIN" ? "Open document requests" : "Open my document requests"}</button>
    </section>}
  </div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
