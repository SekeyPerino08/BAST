import type { RequestHandler } from "express";
import type {
  ChangePasswordBody,
  LoginBody,
  PasswordResetCompleteBody,
  PasswordResetRequestBody,
} from "../schemas/auth.schema.js";
import { audit } from "../audit.js";
import { logAudit } from "../services/audit.service.js";
import { prisma } from "../lib/prisma.js";
import {
  changePassword,
  completePasswordReset,
  getAuthUser,
  login,
  logoutAll,
  requestPasswordReset,
} from "../services/auth.service.js";
import { clearAuthCookie, setAuthCookie } from "../utils/cookies.js";

export const loginController: RequestHandler<object, unknown, LoginBody> = async (req, res, next) => {
  try {
    const result = await login(req.body.email, req.body.password, req);
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

export const completePasswordResetController: RequestHandler<object, unknown, PasswordResetCompleteBody> = async (
  req,
  res,
  next,
) => {
  try {
    await completePasswordReset(req.body.token, req.body.newPassword, req);
    clearAuthCookie(res);
    res.status(204).end();
  } catch (error) {
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
