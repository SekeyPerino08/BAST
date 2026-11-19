import { Resend } from "resend";
import { env } from "../config/env.js";

export async function sendPasswordResetCode(email: string, code: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    throw new Error("RESEND_API_KEY and MAIL_FROM must be configured to send password reset codes");
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.MAIL_FROM,
    to: email,
    subject: "Your password reset code",
    text: `Your password reset verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your password reset verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
  });
  if (error) throw new Error(`Resend failed to send the password reset code: ${error.message}`);
}
