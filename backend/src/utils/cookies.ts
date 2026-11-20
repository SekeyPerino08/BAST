import type { Response } from "express";
import { env } from "../config/env.js";
import { durationToMilliseconds } from "./duration.js";

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.COOKIE_SAMESITE,
  path: "/",
};
const passwordResetCookieOptions = {
  ...cookieOptions,
  path: "/",
};

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(env.COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: durationToMilliseconds(env.JWT_EXPIRES_IN),
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(env.COOKIE_NAME, cookieOptions);
}

export function setPasswordResetCookie(res: Response, token: string): void {
  res.cookie("password_reset_session", token, {
    ...passwordResetCookieOptions,
    maxAge: 10 * 60 * 1000,
  });
}

export function clearPasswordResetCookie(res: Response): void {
  res.clearCookie("password_reset_session", passwordResetCookieOptions);
}
