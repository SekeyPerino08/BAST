"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ApiError, apiFetch } from "../../lib/api";

function subscribeToHashChange(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getResetToken() {
  return new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
}

export default function ResetPasswordPage() {
  const token = useSyncExternalStore(subscribeToHashChange, getResetToken, () => "");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, "", "/reset-password");
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch<void>("/api/auth/password-reset/complete", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setCompleted(true);
      setNewPassword("");
      setMessage("Your password has been updated. Sign in with your new password.");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not reset your password. Request a new link and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white bg-white p-7 shadow-xl sm:p-9">
        <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
        {!token && !message && <p className="mt-2 text-sm text-slate-600">The reset link is missing or has expired. <Link href="/forgot-password" className="font-medium text-[#1d6a45] hover:underline">Request another link</Link>.</p>}
        <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" minLength={8} required
              value={newPassword} onChange={(event) => setNewPassword(event.target.value)}
              aria-describedby="password-requirements"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1d6a45]" />
            <p id="password-requirements" className="mt-1 text-xs text-slate-600">Use at least 8 characters with a letter and a number.</p>
          </div>
          {message && <p role="status" className="rounded-xl bg-[#ecf9f0] p-3 text-sm text-[#0d412e]">{message}</p>}
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <button type="submit" disabled={saving || !token || completed}
            className="w-full rounded-xl bg-[#1d6a45] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0d412e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] disabled:opacity-60">
            {saving ? "Updating…" : "Update password"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm"><Link href="/login" className="font-medium text-[#1d6a45] hover:underline">Back to sign in</Link></p>
      </section>
    </main>
  );
}
