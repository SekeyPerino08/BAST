import type { RequestParamHandler } from "express";

const studentNumberPattern = /^[A-Za-z0-9-]{3,20}$/;
const legacyIdPattern = /^[A-Za-z0-9_-]{10,64}$/;

export function validateStudentNumberParams(...names: string[]): RequestParamHandler {
  return (req, res, next, value, name) => {
    if (
      !names.includes(name) ||
      typeof value !== "string" ||
      (!studentNumberPattern.test(value) && !legacyIdPattern.test(value))
    ) {
      res.status(400).json({
        message: "The student number is invalid",
        code: "INVALID_STUDENT_NUMBER",
        requestId: String(req.id),
      });
      return;
    }
    next();
  };
}
