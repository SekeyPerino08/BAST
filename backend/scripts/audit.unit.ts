import assert from "node:assert/strict";
import { Role } from "@prisma/client";
import type { Request, Response } from "express";
import { authorize } from "../src/middleware/authorize.js";

for (const role of [Role.TEACHER, Role.STUDENT]) {
  let statusCode = 0;
  let passed = false;
  const req = { user: { id: "test-user", role, email: "test@example.test" } } as unknown as Request;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  } as unknown as Response;
  authorize(Role.ADMIN)(req, res, () => {
    passed = true;
  });
  assert.equal(statusCode, 403, `${role} must be forbidden from admin audit routes`);
  assert.equal(passed, false);
}

console.log("Audit authorization unit tests passed");
