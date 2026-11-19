import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import type { Request } from "express";
import { audit } from "../audit.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { signToken } from "../utils/jwt.js";
import { logAudit } from "./audit.service.js";
import { sendPasswordResetCode } from "./email.service.js";
import { logger } from "../lib/logger.js";
import { isAccountLocked, nextLoginFailureState, passwordPolicyError } from "../utils/password-policy.js";

const authUserInclude = {
  userProfile: {
    select: { photoMime: true, updatedAt: true },
  },
  student: {
    select: { studentNo: true, firstName: true, middleName: true, lastName: true },
  },
  teacher: {
    select: { employeeNo: true, firstName: true, middleName: true, lastName: true },
  },
} satisfies Prisma.UserInclude;

type AuthUser = Prisma.UserGetPayload<{ include: typeof authUserInclude }>;

const dummyPasswordHash = bcrypt.hash("invalid-login-dummy-value", 12);

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  mustChangePassword: boolean;
  profilePhotoUpdatedAt: string | null;
  profile:
    | { type: "student"; studentNo: string; firstName: string; middleName: string | null; lastName: string }
    | { type: "teacher"; employeeNo: string; firstName: string; middleName: string | null; lastName: string }
    | null;
}

function profilePhotoUpdatedAt(user: AuthUser): string | null {
  return user.userProfile?.photoMime ? user.userProfile.updatedAt.toISOString() : null;
}

export function toPublicUser(user: AuthUser): PublicUser {
  if (user.student) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      profilePhotoUpdatedAt: profilePhotoUpdatedAt(user),
      profile: { type: "student", ...user.student },
    };
  }
  if (user.teacher) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      profilePhotoUpdatedAt: profilePhotoUpdatedAt(user),
      profile: { type: "teacher", ...user.teacher },
    };
  }
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    profilePhotoUpdatedAt: profilePhotoUpdatedAt(user),
    profile: null,
  };
}

export async function login(
  identifier: string,
  password: string,
  request?: Pick<Request, "user" | "ip">,
): Promise<{ user: PublicUser; token: string }> {
  const normalizedIdentifier = identifier.trim();
  const user = await prisma.user.findUnique({
    where: { loginId: normalizedIdentifier.toUpperCase() },
    include: authUserInclude,
  }) ?? (normalizedIdentifier.includes("@")
    ? await prisma.user.findUnique({
        where: { email: normalizedIdentifier.toLowerCase() },
        include: authUserInclude,
      })
    : null);
  const now = new Date();
  if (!user) {
    await bcrypt.compare(password, await dummyPasswordHash);
    await prisma.$transaction(async (tx) => {
      if (request) {
        await audit(tx, request, {
          action: "LOGIN_FAILED",
          entityType: "User",
          after: { identifier: normalizedIdentifier },
        });
      }
      await logAudit({ action: "LOGIN_FAILED", entity: "User", details: { identifier: normalizedIdentifier }, ipAddress: request?.ip }, tx);
    });
    throw new AppError("Invalid login ID or password", 401);
  }

  if (!user.isActive || isAccountLocked(user.lockedUntil, now)) {
    await bcrypt.compare(password, await dummyPasswordHash);
    await prisma.$transaction(async (tx) => {
      if (request) {
        await audit(tx, request, {
          action: "LOGIN_FAILED",
          entityType: "User",
          entityId: user.id,
          after: { identifier: normalizedIdentifier, reason: "account_unavailable" },
        });
      }
      await logAudit({
        userId: user.id,
        action: "LOGIN_BLOCKED",
        entity: "User",
        entityId: user.id,
        ipAddress: request?.ip,
      }, tx);
    });
    throw new AppError("Invalid login ID or password", 401);
  }

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    await prisma.$transaction(async (tx) => {
      const incremented = await tx.user.update({
        where: { id: user.id },
        data: { failedLoginCount: { increment: 1 } },
        select: { failedLoginCount: true },
      });
      const failureState = nextLoginFailureState(incremented.failedLoginCount - 1, now);
      const shouldLock = failureState.lockedUntil !== null;
      if (shouldLock) {
        await tx.user.update({
          where: { id: user.id },
          data: failureState,
        });
      }
      await logAudit({
        userId: user.id,
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: user.id,
        details: { identifier: normalizedIdentifier },
        ipAddress: request?.ip,
      }, tx);
      if (request) {
        await audit(tx, request, {
          action: "LOGIN_FAILED",
          entityType: "User",
          entityId: user.id,
          after: { identifier: normalizedIdentifier },
        });
      }
      if (shouldLock) {
        await logAudit({
          userId: user.id,
          action: "ACCOUNT_LOCKED",
          entity: "User",
          entityId: user.id,
          ipAddress: request?.ip,
        }, tx);
      }
    });
    throw new AppError("Invalid login ID or password", 401);
  }

  const signedInUser = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
      include: authUserInclude,
    });
    await logAudit({
      userId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      ipAddress: request?.ip,
    }, tx);
    if (request) {
      await audit(tx, request, {
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
        after: { identifier: normalizedIdentifier },
      });
    }
    return updated;
  });
  return {
    user: toPublicUser(signedInUser),
    token: signToken({ sub: user.id, role: user.role, ver: signedInUser.tokenVersion }),
  };
}

export async function getAuthUser(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: authUserInclude,
  });
  if (!user || !user.isActive) {
    throw new AppError("Not authenticated", 401);
  }
  return toPublicUser(user);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ipAddress?: string,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, passwordHash: true },
  });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError("Current password is incorrect", 401);
  }

  const policyError = passwordPolicyError(newPassword, currentPassword, user.email);
  if (policyError) throw new AppError(policyError, 400);

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    });
    await logAudit({ userId, action: "PASSWORD_CHANGE", entity: "User", entityId: userId, ipAddress }, tx);
    return result;
  });
  return signToken({ sub: updated.id, role: updated.role, ver: updated.tokenVersion });
}

export async function requestPasswordReset(
  email: string,
  request?: Pick<Request, "ip" | "user">,
): Promise<{ message: string }> {
  if (!env.PASSWORD_RESET_DELIVERY_URL || !env.PASSWORD_RESET_DELIVERY_SECRET) {
    throw new AppError("Password reset delivery is not configured", 503, "PASSWORD_RESET_UNAVAILABLE");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, isActive: true },
  });
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const validUser = user?.isActive ? user : null;

  if (validUser) {
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: validUser.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: validUser.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      if (request?.user) {
        await audit(tx, request, {
          action: "PASSWORD_RESET_REQUESTED",
          entityType: "User",
          entityId: validUser.id,
          after: { resetLinkIssued: true },
        });
      }
    });
  }

  const resetUrl = new URL("/reset-password", env.CORS_ORIGIN[0]);
  resetUrl.hash = new URLSearchParams({ token: rawToken }).toString();
  const expirePendingToken = async () => {
    if (validUser) {
      await prisma.passwordResetToken.updateMany({
        where: { userId: validUser.id, tokenHash, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    }
  };
  let delivery: Response;
  try {
    delivery = await fetch(env.PASSWORD_RESET_DELIVERY_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.PASSWORD_RESET_DELIVERY_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ to: normalizedEmail, resetUrl: resetUrl.toString() }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    await expirePendingToken();
    throw new AppError("Password reset delivery is temporarily unavailable", 503, "PASSWORD_RESET_DELIVERY_FAILED");
  }
  if (!delivery.ok) {
    await expirePendingToken();
    throw new AppError("Password reset delivery is temporarily unavailable", 503, "PASSWORD_RESET_DELIVERY_FAILED");
  }

  return { message: "If an active account matches that email, password reset instructions will be sent." };
}

const passwordResetCodeMessage =
  "If an active account matches that email, a password reset code will be sent.";

export async function requestPasswordResetCode(email: string): Promise<{ message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, isActive: true },
  });
  if (!user?.isActive) return { message: passwordResetCodeMessage };

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetCode: code,
      resetCodeExpires: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  try {
    await sendPasswordResetCode(user.email, code);
  } catch (error) {
    await prisma.user.updateMany({
      where: { id: user.id, resetCode: code },
      data: { resetCode: null, resetCodeExpires: null },
    });
    logger.error({ err: error, userId: user.id }, "Password reset code email delivery failed");
  }

  return { message: passwordResetCodeMessage };
}

async function findValidPasswordResetCode(email: string, code: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      isActive: true,
      resetCode: true,
      resetCodeExpires: true,
    },
  });
  if (!user?.isActive || user.resetCode !== code || !user.resetCodeExpires || user.resetCodeExpires <= new Date()) {
    throw new AppError("The verification code is invalid or expired", 400, "INVALID_PASSWORD_RESET");
  }
  return user;
}

export async function verifyPasswordResetCode(email: string, code: string): Promise<void> {
  await findValidPasswordResetCode(email, code);
}

export async function completePasswordResetWithCode(
  email: string,
  code: string,
  newPassword: string,
  request: Pick<Request, "ip" | "user">,
): Promise<void> {
  const user = await findValidPasswordResetCode(email, code);
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new AppError("New password must differ from the current password", 400, "PASSWORD_POLICY");
  }
  const policyError = passwordPolicyError(newPassword, "", user.email);
  if (policyError) throw new AppError(policyError, 400, "PASSWORD_POLICY");
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: user.id,
        isActive: true,
        resetCode: code,
        resetCodeExpires: { gt: now },
      },
      data: {
        passwordHash,
        passwordChangedAt: now,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        tokenVersion: { increment: 1 },
        resetCode: null,
        resetCodeExpires: null,
      },
    });
    if (updated.count !== 1) {
      throw new AppError("The verification code is invalid or expired", 400, "INVALID_PASSWORD_RESET");
    }

    await audit(tx, request, {
      action: "PASSWORD_RESET",
      entityType: "User",
      entityId: user.id,
      after: { credentialChanged: true },
    });
    await logAudit({
      userId: user.id,
      action: "PASSWORD_RESET",
      entity: "User",
      entityId: user.id,
      ipAddress: request.ip,
    }, tx);
  });
}

export async function completePasswordReset(
  token: string,
  newPassword: string,
  request: Pick<Request, "ip" | "user">,
): Promise<void> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      consumedAt: true,
      user: { select: { id: true, email: true, passwordHash: true, isActive: true } },
    },
  });
  const now = new Date();
  if (!reset || reset.consumedAt || reset.expiresAt <= now || !reset.user.isActive) {
    throw new AppError("This password reset link is invalid or expired", 400, "INVALID_PASSWORD_RESET");
  }
  if (await bcrypt.compare(newPassword, reset.user.passwordHash)) {
    throw new AppError("New password must differ from the current password", 400, "PASSWORD_POLICY");
  }

  const policyError = passwordPolicyError(newPassword, "", reset.user.email);
  if (policyError) throw new AppError(policyError, 400, "PASSWORD_POLICY");
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: reset.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) {
      throw new AppError("This password reset link is invalid or expired", 400, "INVALID_PASSWORD_RESET");
    }
    const updatedUser = await tx.user.update({
      where: { id: reset.userId, isActive: true },
      data: {
        passwordHash,
        passwordChangedAt: now,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        tokenVersion: { increment: 1 },
      },
    });
    await audit(tx, request, {
      action: "PASSWORD_RESET",
      entityType: "User",
      entityId: updatedUser.id,
      after: { credentialChanged: true },
    });
    await logAudit({
      userId: updatedUser.id,
      action: "PASSWORD_RESET",
      entity: "User",
      entityId: updatedUser.id,
      ipAddress: request.ip,
    }, tx);
  });
}

export async function logoutAll(
  userId: string,
  request?: Pick<Request, "user" | "ip">,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    if (request) {
      await audit(tx, request, { action: "LOGOUT_ALL", entityType: "User", entityId: userId });
    }
    await logAudit({ userId, action: "LOGOUT_ALL", entity: "User", entityId: userId, ipAddress: request?.ip }, tx);
  });
}
