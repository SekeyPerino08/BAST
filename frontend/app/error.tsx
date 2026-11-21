"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7faf8] px-4 py-12 dark:bg-slate-950">
      <section role="alert" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">The page could not be loaded. Try again, or return to the dashboard.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="min-h-10 rounded-lg bg-[#0d412e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#135b3b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45]">
            Try again
          </button>
          <Link href="/" className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
