import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export async function sendPasswordResetCode(email: string, code: string): Promise<void> {
  if (!env.SMTP_HOST || !env.MAIL_FROM) {
    throw new Error("SMTP_HOST and MAIL_FROM must be configured to send password reset codes");
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER && env.SMTP_PASSWORD
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
      : {}),
  });

  await transporter.sendMail({
    from: env.MAIL_FROM,
    to: email,
    subject: "Your password reset code",
    text: `Your password reset verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your password reset verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
  });
}
