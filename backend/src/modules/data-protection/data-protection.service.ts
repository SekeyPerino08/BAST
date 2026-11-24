import type { Request } from "express";
import { z } from "zod";
import { audit } from "../../audit.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { parseDateString, todayInManila } from "../../utils/dates.js";
import { recoveryExerciseSchema } from "./data-protection.schema.js";

export async function getDataProtectionOverview() {
  const exercises = await prisma.recoveryExercise.findMany({
    orderBy: [{ testedAt: "desc" }, { createdAt: "desc" }],
    take: 20,
    include: { recordedBy: { select: { firstName: true, lastName: true, email: true } } },
  });
  return {
    policies: [
      { area: "Password reset codes", retention: "Expire after 10 minutes; expired sessions are cleaned during reset requests." },
      { area: "CSV import previews", retention: "Expire after 24 hours; preview rows are cleared when import history is listed." },
      { area: "Audit log", retention: "Append-only in the application; no automatic retention/deletion period is configured." },
      { area: "Student records", retention: "No automatic deletion; retention must follow the school's records policy." },
    ],
    backupProvider: "Database backups and point-in-time recovery are managed in Neon; this application does not execute restores.",
    exercises,
  };
}

export async function recordRecoveryExercise(rawInput: unknown, request: Request) {
  const parsed = recoveryExerciseSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      errors: parsed.error.flatten().fieldErrors,
    });
  }
  if (parsed.data.testedAt > todayInManila()) {
    throw new AppError("Recovery exercise date cannot be in the future", 400, "INVALID_TEST_DATE");
  }
  if (!request.user) throw new AppError("Not authenticated", 401);
  const recordedById = request.user.id;
  const testedAt = parseDateString(parsed.data.testedAt);
  return prisma.$transaction(async (transaction) => {
    const exercise = await transaction.recoveryExercise.create({
      data: {
        ...parsed.data,
        testedAt,
        recordedById,
      },
      include: { recordedBy: { select: { firstName: true, lastName: true, email: true } } },
    });
    await audit(transaction, request, {
      action: "RECOVERY_EXERCISE_RECORDED",
      entityType: "RecoveryExercise",
      entityId: exercise.id,
      after: {
        kind: exercise.kind,
        result: exercise.result,
        testedAt: exercise.testedAt.toISOString(),
      },
    });
    return exercise;
  });
}
