import type { RequestHandler } from "express";
import type {
  ChangePasswordBody,
  LoginBody,
  PasswordResetCompleteBody,
  PasswordResetRequestBody,
  VerifyPasswordResetCodeBody,
} from "../schemas/auth.schema.js";
import { audit } from "../audit.js";
import { logAudit } from "../services/audit.service.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import {
  changePassword,
  completePasswordReset,
  getPasswordResetSession,
  getAuthUser,
  login,
  logoutAll,
  requestPasswordReset,
  verifyPasswordResetCode,
} from "../services/auth.service.js";
import {
  clearAuthCookie,
  clearPasswordResetCookie,
  setAuthCookie,
  setPasswordResetCookie,
} from "../utils/cookies.js";

export const loginController: RequestHandler<object, unknown, LoginBody> = async (req, res, next) => {
  try {
    const result = await login(req.body.identifier, req.body.password, req);
    setAuthCookie(res, result.token);
    res.status(200).json({ user: result.user });
  } catch (error) {
    next(error);
  }
};

export const requestPasswordResetController: RequestHandler<object, unknown, PasswordResetRequestBody> = async (
  req,
  res,
  next,
) => {
  try {
    res.status(202).json(await requestPasswordReset(req.body.email));
  } catch (error) {
    next(error);
  }
};

export const verifyPasswordResetCodeController: RequestHandler<
  object,
  unknown,
  VerifyPasswordResetCodeBody
> = async (req, res, next) => {
  try {
    const sessionToken = await verifyPasswordResetCode(req.body.email, req.body.code);
    setPasswordResetCookie(res, sessionToken);
    res.status(200).json({ message: "Verification succeeded." });
  } catch (error) {
    next(error);
  }
};

export const passwordResetSessionController: RequestHandler = async (req, res, next) => {
  try {
    const sessionToken = req.cookies?.password_reset_session;
    await getPasswordResetSession(typeof sessionToken === "string" ? sessionToken : "");
    res.status(200).json({ verified: true });
  } catch (error) {
    if (error instanceof AppError && error.code === "INVALID_PASSWORD_RESET_SESSION") {
      clearPasswordResetCookie(res);
    }
    next(error);
  }
};

export const completePasswordResetController: RequestHandler<object, unknown, PasswordResetCompleteBody> = async (
  req,
  res,
  next,
) => {
  try {
    const sessionToken = req.cookies?.password_reset_session;
    await completePasswordReset(
      req.body.newPassword,
      typeof sessionToken === "string" ? sessionToken : "",
      req,
    );
    clearAuthCookie(res);
    clearPasswordResetCookie(res);
    res.status(204).end();
  } catch (error) {
    if (error instanceof AppError && error.code === "INVALID_PASSWORD_RESET_SESSION") {
      clearPasswordResetCookie(res);
    }
    next(error);
  }
};

export const logoutController: RequestHandler = async (req, res, next) => {
  try {
    if (req.user) {
      await prisma.$transaction(async (transaction) => {
        await audit(transaction, req, {
          action: "LOGOUT",
          entityType: "User",
          entityId: req.user?.id,
        });
        await logAudit({
          userId: req.user?.id,
          action: "LOGOUT",
          entity: "User",
          entityId: req.user?.id,
          ipAddress: req.ip,
        }, transaction);
      });
    }
    clearAuthCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const meController: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    res.status(200).json({ user: await getAuthUser(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const changePasswordController: RequestHandler<object, unknown, ChangePasswordBody> = async (
  req,
  res,
  next,
) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    const token = await changePassword(req.user.id, req.body.currentPassword, req.body.newPassword, req.ip);
    setAuthCookie(res, token);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const logoutAllController: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    await logoutAll(req.user.id, req);
    clearAuthCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
