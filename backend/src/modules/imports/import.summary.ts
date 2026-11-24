import type { ImportJob } from "@prisma/client";
import { AppError } from "../../utils/AppError.js";

type ImportSummarySource = Pick<
  ImportJob,
  | "id"
  | "type"
  | "status"
  | "fileName"
  | "options"
  | "totals"
  | "rows"
  | "expiresAt"
  | "createdById"
  | "committedAt"
  | "result"
  | "createdAt"
>;

export function normalizeImportTotals(value: unknown) {
  const totals = record(value);
  return {
    rows: count(totals, ["totalRows", "rows"]),
    valid: count(totals, ["validRows", "valid"]),
    warnings: count(totals, ["warningRows", "warnings"]),
    errors: count(totals, ["errorRows", "errors"]),
  };
}

export function summarizeImportJob(job: ImportSummarySource) {
  const options = record(job.options);
  const recognized = columns(options.recognizedColumns);
  const ignored = strings(options.ignoredColumns);
  const willEnroll = typeof options.willEnroll === "boolean"
    ? options.willEnroll
    : containsEnrollment(job.rows);

  return {
    id: job.id,
    type: job.type,
    status: job.status,
    fileName: job.fileName,
    options: job.options,
    totals: normalizeImportTotals(job.totals),
    columns: { recognized, ignored },
    willEnroll,
    previouslyImported: null,
    expiresAt: job.expiresAt,
    createdById: job.createdById,
    committedAt: job.committedAt,
    result: job.result,
    createdAt: job.createdAt,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function count(totals: Record<string, unknown>, keys: string[]): number {
  const value = keys.map((key) => totals[key]).find((item) => typeof item === "number");
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new AppError("Stored import totals are invalid", 500, "IMPORT_SUMMARY_INVALID");
  }
  return value;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function columns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    const column = record(item).column;
    return typeof column === "string" ? [column] : [];
  });
}

function containsEnrollment(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => {
    const enrollment = record(item).enrollment;
    return enrollment !== undefined && enrollment !== null;
  });
}
