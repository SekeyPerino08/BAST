import { Prisma, PrismaClient } from "@prisma/client";
import type { Request } from "express";

type AuditClient = PrismaClient | Prisma.TransactionClient;
type AuditRequest = Pick<Request, "user" | "ip">;

interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string;
  studentId?: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditStudentViewInput {
  action: string;
  entityType: string;
  entityId?: string;
  studentId: string;
}

function safeJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  const sanitized = redact(value);
  return sanitized === null ? undefined : sanitized as Prisma.InputJsonValue;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /(password|token|secret|authorization|cookie)/i.test(key) ? "[REDACTED]" : redact(entry),
    ]),
  );
}

export async function audit(client: AuditClient, req: AuditRequest, input: AuditInput): Promise<void> {
  const actor = req.user;
  if (input.action.startsWith("VIEW_") && actor && input.studentId) {
    const lockKey = `${actor.id}:${input.studentId}`;
    await client.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text`;
    const recentView = await client.auditEntry.findFirst({
      where: {
        actorUserId: actor.id,
        studentId: input.studentId,
        action: { startsWith: "VIEW_" },
        at: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (recentView) return;
  }

  await client.auditEntry.create({
    data: {
      actorUserId: actor?.id,
      actorRole: actor?.role,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      studentId: input.studentId,
      before: safeJson(input.before),
      after: safeJson(input.after),
      ip: req.ip,
    },
  });
}

export async function auditStudentViews(
  client: Prisma.TransactionClient,
  req: AuditRequest,
  inputs: AuditStudentViewInput[],
): Promise<void> {
  if (!inputs.length) return;

  const actor = req.user;
  const inputsByStudent = new Map<string, AuditStudentViewInput>();
  if (actor) {
    for (const input of inputs) {
      if (!inputsByStudent.has(input.studentId)) inputsByStudent.set(input.studentId, input);
    }
    const lockKeys = [...inputsByStudent.keys()]
      .map((studentId) => `${actor.id}:${studentId}`)
      .sort();
    await client.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(lock_key))::text AS locked
      FROM unnest(ARRAY[${Prisma.join(lockKeys)}]::text[]) AS lock_keys(lock_key)
      ORDER BY lock_key
    `;

    const recentViews = await client.auditEntry.findMany({
      where: {
        actorUserId: actor.id,
        studentId: { in: [...inputsByStudent.keys()] },
        action: { startsWith: "VIEW_" },
        at: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { studentId: true },
    });
    for (const recentView of recentViews) {
      if (recentView.studentId) inputsByStudent.delete(recentView.studentId);
    }
  }

  const entries = actor ? [...inputsByStudent.values()] : inputs;
  const data = entries.map((input) => ({
    actorUserId: actor?.id,
    actorRole: actor?.role,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    studentId: input.studentId,
    ip: req.ip,
  }));
  if (data.length) await client.auditEntry.createMany({ data });
}
