import bcrypt from "bcryptjs";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
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

const passwordResetRequestMessage =
  "If an active account matches that email, a verification code will be sent.";

function passwordResetCodeHash(userId: string, challengeId: string, code: string): string {
  return createHmac("sha256", env.JWT_SECRET)
    .update(`${userId}:${challengeId}:${code}`)
    .digest("hex");
}

function passwordResetSessionHash(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex");
}

function matchesPasswordResetCode(userId: string, challengeId: string, code: string, storedHash: string): boolean {
  const expected = Buffer.from(passwordResetCodeHash(userId, challengeId, code), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return expected.length === stored.length && timingSafeEqual(expected, stored);
}

function invalidPasswordResetCode(): AppError {
  return new AppError("The verification code is invalid or expired", 400, "INVALID_PASSWORD_RESET");
}

export async function requestPasswordReset(
  email: string,
  request?: Pick<Request, "ip" | "user">,
): Promise<{ message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, isActive: true },
  });
  if (!user?.isActive) return { message: passwordResetRequestMessage };

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const challengeId = randomBytes(16).toString("hex");
  const tokenHash = passwordResetCodeHash(user.id, challengeId, code);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetSession.deleteMany({ where: { expiresAt: { lte: now } } });
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.passwordResetSession.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetToken.create({
      data: {
        id: challengeId,
        userId: user.id,
        tokenHash,
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        createdAt: now,
      },
    });
    if (request?.user) {
      await audit(tx, request, {
        action: "PASSWORD_RESET_REQUESTED",
        entityType: "User",
        entityId: user.id,
        after: { verificationCodeIssued: true },
      });
    }
  });

  try {
    await sendPasswordResetCode(user.email, code);
  } catch (error) {
    await prisma.passwordResetToken.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    logger.error({ err: error, userId: user.id }, "Password reset code delivery failed");
  }

  return { message: passwordResetRequestMessage };
}

export async function verifyPasswordResetCode(email: string, code: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, isActive: true },
  });
  if (!user?.isActive) throw invalidPasswordResetCode();

  const now = new Date();
  const challenges = await prisma.passwordResetToken.findMany({
    where: { userId: user.id, consumedAt: null, expiresAt: { gt: now } },
    select: { id: true, tokenHash: true },
    orderBy: { createdAt: "desc" },
  });
  const match = challenges.find(({ id, tokenHash }) => matchesPasswordResetCode(user.id, id, code, tokenHash));
  if (!match) throw invalidPasswordResetCode();

  const sessionToken = randomBytes(32).toString("base64url");
  const sessionHash = passwordResetSessionHash(sessionToken);
  const sessionExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetSession.deleteMany({ where: { expiresAt: { lte: now } } });
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: match.id, userId: user.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) throw invalidPasswordResetCode();

    await tx.passwordResetSession.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetSession.create({
      data: { userId: user.id, sessionHash, expiresAt: sessionExpiresAt },
    });
  });
  return sessionToken;
}

export async function getPasswordResetSession(sessionToken: string) {
  if (!sessionToken) {
    throw new AppError("Password reset verification is required", 401, "INVALID_PASSWORD_RESET_SESSION");
  }
  const session = await prisma.passwordResetSession.findUnique({
    where: { sessionHash: passwordResetSessionHash(sessionToken) },
    select: { id: true, userId: true, expiresAt: true, user: { select: { isActive: true } } },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    throw new AppError("Password reset verification is invalid or expired", 401, "INVALID_PASSWORD_RESET_SESSION");
  }
  return session;
}

export async function completePasswordReset(
  newPassword: string,
  sessionToken: string,
  request: Pick<Request, "ip" | "user">,
): Promise<void> {
  const resetSession = await getPasswordResetSession(sessionToken);
  const user = await prisma.user.findUnique({
    where: { id: resetSession.userId },
    select: { id: true, email: true, passwordHash: true, isActive: true },
  });
  if (!user?.isActive) {
    throw new AppError("Password reset verification is invalid or expired", 401, "INVALID_PASSWORD_RESET_SESSION");
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new AppError("New password must differ from the current password", 400, "PASSWORD_POLICY");
  }

  const policyError = passwordPolicyError(newPassword, "", user.email);
  if (policyError) throw new AppError(policyError, 400, "PASSWORD_POLICY");
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetSession.deleteMany({
      where: {
        id: resetSession.id,
        sessionHash: passwordResetSessionHash(sessionToken),
        expiresAt: { gt: now },
      },
    });
    if (consumed.count !== 1) {
      throw new AppError("Password reset verification is invalid or expired", 401, "INVALID_PASSWORD_RESET_SESSION");
    }

    const updatedUser = await tx.user.update({
      where: { id: user.id, isActive: true },
      data: {
        passwordHash,
        passwordChangedAt: now,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        tokenVersion: { increment: 1 },
      },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.passwordResetSession.deleteMany({ where: { userId: user.id } });
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
