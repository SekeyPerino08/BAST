// Checks database connectivity and reports the service health.
import type { Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

export async function getHealth(_req: Request, res: Response): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", db: "connected" });
  } catch (error) {
    logger.error({ err: error }, "Health check could not reach the database");
    res.status(500).json({ status: "error", db: "disconnected" });
  }
}
