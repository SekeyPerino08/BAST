"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, apiFetch } from "../../lib/api";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [verified, setVerified] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await apiFetch<{ message: string }>("/api/auth/verify-reset-code", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setVerified(true);
      setMessage(result.message);
    } catch (reason) {
      setVerified(false);
      setError(reason instanceof ApiError ? reason.message : "Could not verify the code. Request a new one and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch<void>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, code, newPassword }),
      });
      setCompleted(true);
      setNewPassword("");
      setCode("");
      setMessage("Your password has been updated. Sign in with your new password.");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not reset your password. Request a new code and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white bg-white p-7 shadow-xl sm:p-9">
        <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
        <p className="mt-2 text-sm text-slate-600">Verify the code sent to your email before choosing a new password.</p>
        <form onSubmit={(event) => void verify(event)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input id="reset-email" type="email" autoComplete="email" required value={email}
              disabled={saving || completed}
              onChange={(event) => { setEmail(event.target.value); setVerified(false); setMessage(""); setError(""); }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1d6a45]" />
          </div>
          <div>
            <label htmlFor="reset-code" className="mb-1.5 block text-sm font-medium text-slate-700">6-digit verification code</label>
            <input id="reset-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code}
              disabled={saving || completed}
              onChange={(event) => { setCode(event.target.value); setVerified(false); setMessage(""); setError(""); }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1d6a45]" />
          </div>
          <button type="submit" disabled={saving || completed}
            className="w-full rounded-xl bg-[#1d6a45] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0d412e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] disabled:opacity-60">
            {saving ? "Verifying…" : verified ? "Code verified" : "Verify code"}
          </button>
        </form>
        {verified && !completed && <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" minLength={8} required
              disabled={saving}
              value={newPassword} onChange={(event) => setNewPassword(event.target.value)}
              aria-describedby="password-requirements"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1d6a45]" />
            <p id="password-requirements" className="mt-1 text-xs text-slate-600">Use at least 8 characters with a letter and a number.</p>
          </div>
          <button type="submit" disabled={saving || completed}
            className="w-full rounded-xl bg-[#1d6a45] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0d412e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] disabled:opacity-60">
            {saving ? "Updating…" : "Update password"}
          </button>
        </form>
        }
        {message && <p role="status" className="mt-4 rounded-xl bg-[#ecf9f0] p-3 text-sm text-[#0d412e]">{message}</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <p className="mt-5 text-center text-sm"><Link href="/login" className="font-medium text-[#1d6a45] hover:underline">Back to sign in</Link></p>
      </section>
    </main>
  );
}
