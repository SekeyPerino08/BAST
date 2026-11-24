import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7faf8] px-4 py-12 dark:bg-slate-950">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#1d6a45]">404</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">This page may have moved or is no longer available.</p>
        <Link href="/" className="mt-6 inline-flex min-h-10 items-center rounded-lg bg-[#0d412e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#135b3b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45]">
          Return home
        </Link>
      </section>
    </main>
  );
}
