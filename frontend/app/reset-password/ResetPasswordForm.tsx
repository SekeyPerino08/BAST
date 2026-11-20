"use client";

import { useState } from "react";
import { ApiError, apiFetch } from "../../lib/api";

export default function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      await apiFetch<void>("/api/auth/password-reset/complete", {
        method: "POST",
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      setNewPassword("");
      setConfirmPassword("");
      window.location.replace("/login?passwordReset=success");
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        window.location.replace("/forgot-password");
        return;
      }
      setError(reason instanceof ApiError ? reason.message : "Could not reset your password. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white bg-white p-7 shadow-xl sm:p-9">
        <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
        <p className="mt-2 text-sm text-slate-600">Use at least 8 characters, including a letter and a number.</p>
        <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128}
              required value={newPassword} disabled={saving}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1d6a45] disabled:opacity-60" />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700">Confirm new password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128}
              required value={confirmPassword} disabled={saving}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1d6a45] disabled:opacity-60" />
          </div>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full rounded-xl bg-[#1d6a45] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0d412e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] disabled:opacity-60">
            {saving ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>
    </main>
  );
}
