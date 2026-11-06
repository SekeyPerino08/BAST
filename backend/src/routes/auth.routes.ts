import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createHmac } from "node:crypto";
import { CHANGE_PASSWORD_RATE_LIMIT, LOGIN_RATE_LIMIT } from "../config/limits.js";
import {
  changePasswordController,
  loginController,
  logoutController,
  logoutAllController,
  meController,
  completePasswordResetController,
  requestPasswordResetController,
} from "../controllers/auth.controller.js";
import { authenticate, authenticateAllowPending } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validate.js";
import { changePasswordSchema, loginSchema, passwordResetCompleteSchema, passwordResetRequestSchema } from "../schemas/auth.schema.js";
import { env } from "../config/env.js";

const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: LOGIN_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ message: "Too many attempts, try again later", code: "RATE_LIMITED", requestId: String(req.id) });
  },
});

const emailKey = (email: unknown, fallback: string): string => {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  return normalized
    ? createHmac("sha256", env.JWT_SECRET).update(normalized).digest("hex")
    : fallback;
};
const loginEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: LOGIN_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => emailKey(req.body?.email, req.ip ?? "unknown"),
  handler: (req, res) => {
    res.status(429).json({ message: "Too many sign-in attempts. Try again later.", code: "RATE_LIMITED", requestId: String(req.id) });
  },
});
const resetIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ message: "Too many password reset attempts. Try again later.", code: "RATE_LIMITED", requestId: String(req.id) });
  },
});
const resetEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => emailKey(req.body?.email, req.ip ?? "unknown"),
  handler: (req, res) => {
    res.status(429).json({ message: "Too many password reset attempts. Try again later.", code: "RATE_LIMITED", requestId: String(req.id) });
  },
});

authRouter.post("/login", loginLimiter, validateBody(loginSchema), loginEmailLimiter, loginController);
authRouter.post("/password-reset/request", resetIpLimiter, validateBody(passwordResetRequestSchema), resetEmailLimiter, requestPasswordResetController);
authRouter.post("/password-reset/complete", resetIpLimiter, validateBody(passwordResetCompleteSchema), completePasswordResetController);
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: CHANGE_PASSWORD_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? "unauthenticated",
  handler: (req, res) => {
    res.status(429).json({ message: "Too many attempts, try again later", code: "RATE_LIMITED", requestId: String(req.id) });
  },
});

authRouter.post("/logout", authenticateAllowPending, logoutController);
authRouter.get("/me", authenticateAllowPending, meController);
authRouter.post(
  "/change-password",
  authenticateAllowPending,
  changePasswordLimiter,
  validateBody(changePasswordSchema),
  changePasswordController,
);
authRouter.post("/logout-all", authenticate, logoutAllController);

export default authRouter;
