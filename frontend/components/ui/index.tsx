"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TableHTMLAttributes,
} from "react";
import { LoaderCircle } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { Modal } from "../shared/Modal";

const buttonVariants = {
  primary: "bg-indigo-700 text-white hover:bg-indigo-800",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  destructive: "bg-rose-700 text-white hover:bg-rose-800",
  ghost: "text-slate-700 hover:bg-slate-100",
} as const;

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:opacity-55 ${buttonVariants[variant]} ${className}`}
    >
      {loading && <LoaderCircle size={16} aria-hidden="true" className="animate-spin" />}
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-10 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:border-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-100 ${className}`}
    />
  );
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-10 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:border-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-100 ${className}`}
    >
      {children}
    </select>
  );
}

export function Table({ className = "", ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table {...props} className={`w-full border-collapse text-left text-sm ${className}`} />
  </div>;
}

export function Dialog(props: Parameters<typeof Modal>[0]) {
  return <Modal {...props} />;
}

export const Toast = {
  success: sonnerToast.success,
  error: sonnerToast.error,
  message: sonnerToast.message,
};

const badgeVariants = {
  default: "bg-slate-100 text-slate-800 ring-slate-500/30",
  success: "bg-emerald-100 text-emerald-900 ring-emerald-700/30",
  warning: "bg-amber-100 text-amber-950 ring-amber-700/30",
  destructive: "bg-rose-100 text-rose-900 ring-rose-700/30",
  info: "bg-blue-100 text-blue-900 ring-blue-700/30",
} as const;

export function Badge({
  variant = "default",
  children,
}: Readonly<{ variant?: keyof typeof badgeVariants; children: ReactNode }>) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeVariants[variant]}`}>{children}</span>;
}

export function Skeleton({ className = "" }: Readonly<{ className?: string }>) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: Readonly<{ eyebrow?: string; title: string; description?: string; actions?: ReactNode }>) {
  return <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-wide text-[#285487] dark:text-blue-200">{eyebrow}</p>}
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </header>;
}

export { EmptyState, ErrorState, StatusBadge as BadgeStatus, TableSkeleton } from "../shared";
