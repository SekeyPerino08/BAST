import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">Checking reset access…</main>}>
      <ResetPasswordGate />
    </Suspense>
  );
}

async function ResetPasswordGate() {
  const resetSession = (await cookies()).get("password_reset_session")?.value;
  if (!resetSession) redirect("/forgot-password");

  const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:4000";
  let response: Response;
  try {
    response = await fetch(new URL("/api/auth/password-reset/session", apiOrigin), {
      headers: { Cookie: `password_reset_session=${resetSession}` },
      cache: "no-store",
    });
  } catch {
    redirect("/forgot-password");
  }
  if (!response.ok) redirect("/forgot-password");

  return <ResetPasswordForm />;
}
