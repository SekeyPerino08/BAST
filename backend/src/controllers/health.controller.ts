// Checks database connectivity and reports the service health.
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const databaseCheckTimeoutMs = 2_000;
let pendingDatabaseCheck: Promise<void> | null = null;

class HealthCheckTimeoutError extends Error {
  constructor() {
    super(`Database health check timed out after ${databaseCheckTimeoutMs}ms`);
    this.name = "HealthCheckTimeoutError";
  }
}

function checkDatabase(req: Request): Promise<void> {
  if (!pendingDatabaseCheck) {
    pendingDatabaseCheck = prisma.$queryRaw`SELECT 1`
      .then(() => undefined)
      .catch((error: unknown) => {
        req.log.error({ err: error }, "Health check could not reach the database");
        throw error;
      })
      .finally(() => {
        pendingDatabaseCheck = null;
      });
  }

  const check = pendingDatabaseCheck;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutCheck = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new HealthCheckTimeoutError()), databaseCheckTimeoutMs);
  });

  return Promise.race([check, timeoutCheck]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

export async function getHealth(req: Request, res: Response): Promise<void> {
  try {
    await checkDatabase(req);
    res.status(200).json({ status: "ok", checks: { db: "ok" } });
  } catch (error) {
    if (error instanceof HealthCheckTimeoutError) {
      req.log.error({ err: error }, "Database health check timed out");
    }
    const databaseStatus = error instanceof HealthCheckTimeoutError
      ? `error: timed out after ${databaseCheckTimeoutMs}ms`
      : "error: unavailable";
    res.status(503).json({ status: "error", checks: { db: databaseStatus } });
  }
}
