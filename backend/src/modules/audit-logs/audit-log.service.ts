import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination.js";
import { listAuditLogsQuerySchema } from "./audit-log.schema.js";

type AuditQuery = ReturnType<typeof listAuditLogsQuerySchema.parse>;

function manilaStartOfDay(date: string): Date {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() - 8 * 60 * 60 * 1000);
}

function manilaStartOfNextDay(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1) - 8 * 60 * 60 * 1000);
}

async function auditWhere(query: AuditQuery): Promise<Prisma.AuditEntryWhereInput> {
  const matchingActors = query.actor
    ? await prisma.user.findMany({
        where: { email: { contains: query.actor, mode: "insensitive" } },
        select: { id: true },
      })
    : [];
  return {
    ...(query.action ? { action: query.action } : {}),
    ...(query.entity_type ? { entityType: query.entity_type } : {}),
    ...(query.student ? { studentId: query.student } : {}),
    ...(query.actor ? {
      OR: [
        { actorUserId: query.actor },
        { actorUserId: { in: matchingActors.map(({ id }) => id) } },
      ],
    } : {}),
    ...((query.from || query.to) ? {
      at: {
        ...(query.from ? { gte: manilaStartOfDay(query.from) } : {}),
        ...(query.to ? { lt: manilaStartOfNextDay(query.to) } : {}),
      },
    } : {}),
  };
}

async function findAuditRows(where: Prisma.AuditEntryWhereInput, skip?: number, take?: number) {
  return prisma.auditEntry.findMany({
    where,
    ...(skip === undefined ? {} : { skip }),
    ...(take === undefined ? {} : { take }),
    orderBy: [{ at: "desc" }, { id: "desc" }],
    select: {
      id: true,
      at: true,
      actorUserId: true,
      actorRole: true,
      action: true,
      entityType: true,
      entityId: true,
      studentId: true,
      before: true,
      after: true,
      ip: true,
    },
  });
}

async function addActorDetails<T extends { actorUserId: string | null; actorRole: string | null }>(rows: T[]) {
  const actorIds = [...new Set(rows.flatMap((row) => row.actorUserId ? [row.actorUserId] : []))];
  const users = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, email: true },
  });
  const emails = new Map(users.map((user) => [user.id, user.email]));
  return rows.map(({ actorUserId, actorRole, ...row }) => ({
    ...row,
    actor: actorUserId || actorRole
      ? { id: actorUserId ?? "", email: actorUserId ? emails.get(actorUserId) ?? "" : "", role: actorRole }
      : null,
  }));
}

export async function listAuditLogs(input: unknown) {
  const parsed = listAuditLogsQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten().fieldErrors });
  }
  const query = parsed.data;
  const { skip, take } = parsePagination(query);
  const where = await auditWhere(query);
  const [rows, total] = await Promise.all([
    findAuditRows(where, skip, take),
    prisma.auditEntry.count({ where }),
  ]);
  return {
    data: await addActorDetails(rows),
    meta: buildPaginationMeta(query.page, query.pageSize, total),
  };
}

function csvCell(value: unknown): string {
  const raw = value === null || value === undefined
    ? ""
    : typeof value === "string" ? value : JSON.stringify(value);
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportAuditCsv(input: unknown): Promise<string> {
  const parsed = listAuditLogsQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten().fieldErrors });
  }
  const query = parsed.data;
  const where = await auditWhere(query);
  const total = await prisma.auditEntry.count({ where });
  if (total > 10000) {
    throw new AppError("CSV export is limited to 10,000 entries; narrow the filters.", 413, "EXPORT_TOO_LARGE");
  }
  const rows = await findAuditRows(where, 0, total);
  const withActors = await addActorDetails(rows);
  const header = ["at", "actor", "actor_role", "action", "entity_type", "entity_id", "student_id", "before", "after", "ip"];
  return [
    header.join(","),
    ...withActors.map((row) => [
      row.at.toISOString(),
      row.actor?.email ?? "",
      row.actor?.role ?? "",
      row.action,
      row.entityType,
      row.entityId,
      row.studentId,
      row.before,
      row.after,
      row.ip,
    ].map(csvCell).join(",")),
  ].join("\r\n");
}

export async function getAuditLogFacets() {
  const [actions, entities] = await Promise.all([
    prisma.auditEntry.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditEntry.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  return { actions: actions.map(({ action }) => action), entities: entities.map(({ entityType }) => entityType) };
}

export async function getAuditLog(id: string) {
  const row = (await findAuditRows({ id }, 0, 1))[0];
  if (!row) throw new AppError("Audit log entry not found", 404);
  return (await addActorDetails([row]))[0];
}
