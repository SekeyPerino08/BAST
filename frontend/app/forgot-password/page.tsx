"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiFetch } from "../../lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await apiFetch<{ message: string }>("/api/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(result.message);
      setCodeSent(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not request a reset. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiFetch<{ message: string }>("/api/auth/password-reset/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      router.replace("/reset-password");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "The code is invalid or expired. Request a new code.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white bg-white p-7 shadow-xl sm:p-9">
        <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your account email. If an active account matches, we will send a verification code.
        </p>
        {!codeSent ? (
          <form onSubmit={(event) => void requestCode(event)} className="mt-6 space-y-4">
            <div>
              <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input id="reset-email" type="email" autoComplete="email" maxLength={254} required value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1d6a45]" />
            </div>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
            <button type="submit" disabled={saving}
              className="w-full rounded-xl bg-[#1d6a45] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0d412e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] disabled:opacity-60">
              {saving ? "Sending…" : "Send verification code"}
            </button>
          </form>
        ) : (
          <form onSubmit={(event) => void verifyCode(event)} className="mt-6 space-y-4">
            {message && <p role="status" className="rounded-xl bg-[#ecf9f0] p-3 text-sm text-[#0d412e]">{message}</p>}
            <div>
              <label htmlFor="verification-code" className="mb-1.5 block text-sm font-medium text-slate-700">6-digit verification code</label>
              <input id="verification-code" type="text" inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]{6}" maxLength={6} required value={code}
                onChange={(event) => setCode(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1d6a45]" />
            </div>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
            <button type="submit" disabled={saving}
              className="w-full rounded-xl bg-[#1d6a45] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0d412e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] disabled:opacity-60">
              {saving ? "Verifying…" : "Verify code"}
            </button>
            <button type="button" disabled={saving} onClick={() => { setCodeSent(false); setCode(""); setMessage(""); setError(""); }}
              className="w-full text-sm font-medium text-[#1d6a45] hover:underline disabled:opacity-60">
              Use a different email
            </button>
          </form>
        )}
        <p className="mt-5 text-center text-sm">
          <Link href="/login" className="font-medium text-[#1d6a45] hover:underline">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}
