import assert from "node:assert/strict";
import { getAlumniBatch } from "../src/sources/alumni.js";
import { getLibraryBatch } from "../src/sources/library.js";
import { getLmsBatch } from "../src/sources/lms.js";
import {
  alumniRecordSchema,
  libraryLoanSchema,
  lmsEventSchema,
} from "../src/modules/integrations/integration.schema.js";

assert.deepEqual(getLmsBatch(), getLmsBatch(), "LMS batches must be deterministic");
assert.deepEqual(getLibraryBatch(true), getLibraryBatch(true), "Library next batches must be deterministic");
assert.deepEqual(getAlumniBatch(), getAlumniBatch(), "Alumni batches must be deterministic");

const messyLms = lmsEventSchema.parse(getLmsBatch().rows[0]);
assert.equal(messyLms.studentNo, "STU-2025-0002");
assert.equal(messyLms.firstName, "Ben");
assert.equal(messyLms.lastName, "Ocampo");
assert.equal(lmsEventSchema.safeParse(getLmsBatch().rows[4]).success, false, "Invalid timestamps must be rejected");

const duplicateLms = getLmsBatch().rows.filter((row) => row.externalId === "lms-login-001");
assert.equal(duplicateLms.length, 2, "Fixture must include a duplicate row");
assert.equal(
  libraryLoanSchema.safeParse(getLibraryBatch().rows[2]).success,
  false,
  "A due date before the loan date must be rejected",
);
assert.equal(
  alumniRecordSchema.safeParse(getAlumniBatch().rows[3]).success,
  false,
  "Negative donation amounts must be rejected",
);
console.log("Integration source and validation tests passed");
